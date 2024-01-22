/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import * as Cesium from 'cesium';

// extract the tile format from the uri
function getFormat(uri) {
    const parts = uri.split(/\./g);
    const format = parts[parts.length - 1];
    return format;
}

// extract version, bbox, format and properties from the tileset metadata
function extractCapabilities(ifcApi, modelID, url) {
    const version = ifcApi?.GetModelSchema() !== undefined ? ifcApi.GetModelSchema()?.includes("IFC4")? "IFC4" : ifcApi.GetModelSchema() : 'IFC4';    // eslint-disable-line
    const format = getFormat(url || '');
    const properties =  {};
    ifcApi.CloseModel(modelID);     // eslint-disable-line
    return {
        version,
        format,
        properties
    };
}

const applyMatrix = (matrix, coords) => {
    const result = Cesium.Matrix4.multiplyByPoint(
        Cesium.Matrix4.fromArray(matrix),
        new Cesium.Cartesian3(...coords),
        new Cesium.Cartesian3()
    );

    return [result.x, result.y, result.z];
};

export const ifcDataToJSON = ({ data, ifcApi }) => {
    const settings = {};
    let rawFileData = new Uint8Array(data);
    const modelID = ifcApi.OpenModel(rawFileData, settings); // eslint-disable-line
    ifcApi.LoadAllGeometry(modelID); // eslint-disable-line
    const coordinationMatrix = ifcApi.GetCoordinationMatrix(modelID); // eslint-disable-line
    let meshes = [];
    let minx = Infinity;
    let maxx = -Infinity;
    let miny = Infinity;
    let maxy = -Infinity;
    let minz = Infinity;
    let maxz = -Infinity;
    ifcApi.StreamAllMeshes(modelID, (mesh) => { // eslint-disable-line
        const placedGeometries = mesh.geometries;
        let geometry = [];
        for (let i = 0; i < placedGeometries.size(); i++) {
            const placedGeometry = placedGeometries.get(i);
            const ifcGeometry = ifcApi.GetGeometry(modelID, placedGeometry.geometryExpressID); // eslint-disable-line
            const ifcVertices = ifcApi.GetVertexArray(ifcGeometry.GetVertexData(), ifcGeometry.GetVertexDataSize()); // eslint-disable-line
            const ifcIndices = ifcApi.GetIndexArray(ifcGeometry.GetIndexData(), ifcGeometry.GetIndexDataSize()); // eslint-disable-line
            const positions = new Float64Array(ifcVertices.length / 2);
            const normals = new Float32Array(ifcVertices.length / 2);
            for (let j = 0; j < ifcVertices.length; j += 6) {
                const [x, y, z] = applyMatrix(
                    coordinationMatrix,
                    applyMatrix(placedGeometry.flatTransformation, [
                        ifcVertices[j],
                        ifcVertices[j + 1],
                        ifcVertices[j + 2]
                    ], Cesium), Cesium
                );
                if (x < minx) { minx = x; }
                if (y < miny) { miny = y; }
                if (z < minz) { minz = z; }
                if (x > maxx) { maxx = x; }
                if (y > maxy) { maxy = y; }
                if (z > maxz) { maxz = z; }
                positions[j / 2] = x;
                positions[j / 2 + 1] = y;
                positions[j / 2 + 2] = z;
                normals[j / 2] = ifcVertices[j + 3];
                normals[j / 2 + 1] = ifcVertices[j + 4];
                normals[j / 2 + 2] = ifcVertices[j + 5];
            }
            geometry.push({
                color: placedGeometry.color,
                positions,
                normals,
                indices: Array.from(ifcIndices)
            });
            ifcGeometry.delete();
        }
        const propertyLines = ifcApi.GetLine(modelID, mesh.expressID); // eslint-disable-line
        meshes.push({
            geometry,
            id: mesh.expressID,
            properties: Object.keys(propertyLines).reduce((acc, key) => {
                return {
                    ...acc,
                    [key]: propertyLines[key]?.value || propertyLines[key]
                };
            }, {})
        });
    });
    ifcApi.CloseModel(modelID); // eslint-disable-line
    return {
        meshes,
        extent: [minx, miny, maxx, maxy, minz, maxz],
        center: [minx + (maxx - minx) / 2, miny + (maxy - miny) / 2, minz + (maxz - minz) / 2],
        size: [maxx - minx, maxy - miny, maxz - minz]
    };
};

export const getWebIFC = () => import('web-ifc')
    .then(WebIFC => {
        window.WebIFC = WebIFC;
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath('./web-ifc/'); // eslint-disable-line
        return ifcApi.Init().then(() => ifcApi); // eslint-disable-line
    });
/**
 * Common requests to IFC
 * @module api.IFC
 */

/**
 * get ifc response and additional parsed information such as: version, bbox, format and properties
 * @param {string} url URL of the IFC.ifc file
 * @
 */
export const getCapabilities = (url) => {
    return fetch(url)
        .then((res) => res.arrayBuffer())
        .then((data) => {
            return getWebIFC()
                .then((ifcApi) => {
                    window.ifcApi = ifcApi;
                    let modelID = ifcApi.OpenModel(new Uint8Array(data));   // eslint-disable-line
                    // const { extent, center } = ifcDataToJSON({ ifcApi, data });
                    let capabilities = extractCapabilities(ifcApi, modelID, url);
                    // console.log({extent, center});
                    // let [minx, miny, maxx, maxy] = extent;
                    // todo: read IFCProjectedCRS, IFCMapCONVERSION in case of IFC4
                    let bbox = {
                        bounds: capabilities.version !== "IFC4" ? {
                            minx: 0,
                            miny: 0,
                            maxx: 0,
                            maxy: 0
                        } : {
                            minx: 0,
                            miny: 0,
                            maxx: 0,
                            maxy: 0},
                        crs: 'EPSG:4326'
                    };
                    return { modelData: data, ...capabilities, ...(bbox && { bbox })};
                });
        });
};

/**
 *  constant of MODEL 'format'
 */
export const MODEL = "MODEL";

