/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import axios from 'axios';
import proj4 from 'proj4';

/**
 * get ifc model main info such as: longitude, latitude, height and scale
 * and additional info in case of existing a specified crs like: projectedCrs
 * @param {object} ifcData includes 2 items: ifcApi, WebIFC
 * @param {string} modelVersion the version of ifc file [e.g: IFC2x3, IFC4, IFC4x3]
 * @param {number} modelID it is the model if of the ifc model e.g: 0,1,2
 * @return {object} return originProperties that includes: latitude, longitude, height, scale and "projectedCrs" in case of georeferenced IFC4 model
 * @
 */
// extract model origin point
function getModelOriginCoords(ifcData, modelVersion, modelID) {
    const { ifcApi, WebIFC } = ifcData;
    let originProperties = {};
    if (modelVersion?.includes("IFC4")) {
        let projectedCrs;
        let mapConversion;
        let projectedCrsLineId = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECTEDCRS);    // eslint-disable-line
        let mapConversionLineId = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCMAPCONVERSION);    // eslint-disable-line
        if (projectedCrsLineId.size()) {
            let typeID = projectedCrsLineId.get(0);
            let projectedCrsObj = ifcApi.GetLine(modelID, typeID);    // eslint-disable-line
            projectedCrs = projectedCrsObj?.Name?.value;
        }
        if (mapConversionLineId.size()) {
            let typeID = mapConversionLineId.get(0);
            let mapConversionObj = ifcApi.GetLine(modelID, typeID);    // eslint-disable-line
            mapConversion = {
                northings: mapConversionObj?.Northings?.value,          // x coord
                eastings: mapConversionObj?.Eastings?.value,            // y coord
                orthogonalHeight: mapConversionObj?.OrthogonalHeight?.value,    // height (z coord)
                xAxisOrdinate: mapConversionObj?.XAxisOrdinate?.value,
                xAxisAbscissa: mapConversionObj?.XAxisAbscissa?.value,
                rotation: Math.atan2(mapConversionObj?.XAxisOrdinate?.value || 0, mapConversionObj?.XAxisAbscissa?.value || 0) * 180.0 / Math. PI,
                scale: mapConversionObj?.Scale?.value
            };
            if (proj4.defs(projectedCrs)) {         // if crs in not defined in MS, model will be locatied at 0,0
                let wgs84Origin = proj4(proj4.defs(projectedCrs), proj4.defs('EPSG:4326'), [mapConversion.eastings, mapConversion.northings]);
                originProperties = {
                    projectedCrs,
                    longitude: wgs84Origin[0] || 0,
                    latitude: wgs84Origin[1] || 0,
                    height: mapConversion.orthogonalHeight || 0,
                    scale: mapConversion.scale || 1,
                    heading: mapConversion.rotation,
                    mapConversion
                };
            } else {
                originProperties = {
                    projectedCrs,
                    projectedCrsNotSupported: true,
                    mapConversion
                };
            }
        }
    }
    // todo: maybe in future enhancement, handling georeferenced ifc models with schema less than version 4 like IFC2x3 by getting projection info ref: (https://medium.com/@stijngoedertier/how-to-georeference-a-bim-model-1905d5154cfd)
    return originProperties;
}

// extract the tile format from the uri
function getFormat(uri) {
    const parts = uri.split(/\./g);
    const format = parts[parts.length - 1];
    return format;
}

// extract version, bbox, format and properties from the ifc file
function extractCapabilities(ifcData, modelID, url) {
    const { ifcApi } = ifcData;
    const version = ifcApi?.GetModelSchema(modelID) !== undefined ? ifcApi.GetModelSchema(modelID)?.includes("IFC4")? "IFC4" : ifcApi.GetModelSchema(modelID) : 'IFC4';    // eslint-disable-line
    const format = getFormat(url || '');
    return {
        version,
        format,
        properties: {}
    };
}

/**
 * get ifc response and additional parsed information such as: version, bbox, format and properties
 * @param {object} this object includes: data --> ifc raw data, ifcData: is an object includes ifcApi object (from web-ifc) that enable to read ifc content
 * @return {object} return json object includes meshes array [geometry data of ifc model], extent of ifc model, center and size
 * @
 */
export const ifcDataToJSON = ({ data, ifcData }) => {
    const { ifcApi } = ifcData;
    const settings = {
        COORDINATE_TO_ORIGIN: false, // this property change the position for IFC4 with projection if true
        USE_FAST_BOOLS: true
    };
    let rawFileData = new Uint8Array(data);
    const modelID = ifcApi.OpenModel(rawFileData, settings); // eslint-disable-line
    ifcApi.LoadAllGeometry(modelID); // eslint-disable-line
    const coordinationMatrix = ifcApi.GetCoordinationMatrix(modelID); // eslint-disable-line
    if (coordinationMatrix) {
        ifcApi.SetGeometryTransformation(modelID, coordinationMatrix); // eslint-disable-line
    }
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
                const x = ifcVertices[j];           // index = 0
                const y = ifcVertices[j + 1];       // index = 1
                const z = ifcVertices[j + 2];       // index = 2
                if (x < minx) { minx = x; }
                if (y < miny) { miny = y; }
                if (z < minz) { minz = z; }
                if (x > maxx) { maxx = x; }
                if (y > maxy) { maxy = y; }
                if (z > maxz) { maxz = z; }
                positions[j / 2] = x;
                positions[j / 2 + 1] = y;
                positions[j / 2 + 2] = z;
                normals[j / 2] = ifcVertices[j + 3];        // index = 3
                normals[j / 2 + 1] = ifcVertices[j + 4];    // index = 4
                normals[j / 2 + 2] = ifcVertices[j + 5];    // index = 5
            }
            geometry.push({
                color: placedGeometry.color,
                positions,
                normals,
                indices: Array.from(ifcIndices),
                flatTransformation: placedGeometry.flatTransformation
            });
            ifcGeometry.delete();
        }
        const propertyLines = ifcApi.GetLine(modelID, mesh.expressID); // eslint-disable-line
        meshes.push({
            geometry,
            id: mesh.expressID,
            properties: Object.keys(propertyLines).reduce((acc, key) => {
                acc[key] = propertyLines[key]?.value || propertyLines[key];
                return acc;
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
        const ifcApi = new WebIFC.IfcAPI();
        ifcApi.SetWasmPath('./web-ifc/'); // eslint-disable-line
        return ifcApi.Init().then(() => { return { ifcApi, WebIFC } }); // eslint-disable-line
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
    return axios.get(url, {
        responseType: 'arraybuffer'
    })
        .then(({ data }) => {
            return getWebIFC()
                .then((ifcData) => {
                    const { ifcApi } = ifcData;
                    const settings = {
                        COORDINATE_TO_ORIGIN: false,
                        USE_FAST_BOOLS: true
                    };
                    const modelID = ifcApi.OpenModel(new Uint8Array(data), settings); // eslint-disable-line

                    let capabilities = extractCapabilities(ifcData, modelID, url);
                    // extract model origin info by reading IFCProjectedCRS, IFCMapCONVERSION in case of IFC4
                    const modelOriginProperties = getModelOriginCoords(ifcData, capabilities.version, modelID);
                    capabilities.properties = {
                        ...capabilities.properties,
                        ...modelOriginProperties
                    };
                    ifcApi.CloseModel(modelID);     // eslint-disable-line
                    let properties = capabilities.properties;
                    // todo: getting bbox needs to enhance to get the accurate bbox of the ifc model
                    let bbox = {
                        bounds: {
                            minx: properties.longitude || 0 - 0.001,
                            miny: properties.latitude || 0 - 0.001,
                            maxx: properties.longitude || 0 + 0.001,
                            maxy: properties.latitude || 0 + 0.001
                        },
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

