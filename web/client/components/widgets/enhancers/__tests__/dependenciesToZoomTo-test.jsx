/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import {createSink} from 'recompose';
import expect from 'expect';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

import dependenciesToZoomTo from '../dependenciesToZoomTo';

import MapUtils from '../../../../utils/MapUtils';


describe('widgets dependenciesToZoomTo enhancer', () => {
    let mockAxios;
    const widgetsProps = [{
        id: "123",
        widgetType: "table",
        dependencies: {
            extentObj: {
                extent: [-10, 0, 0, -10],
                crs: "EPSG:3426",
                maxZoom: 21
            }
        },
        geomProp: "the_geom",
        mapSync: true
    },
    {
        id: "123Map",
        widgetType: "map",
        maps: [{}],
        mapSync: true
    }];
    beforeEach((done) => {
        mockAxios = new MockAdapter(axios);
        document.body.innerHTML = '<div id="container"></div>';
        setTimeout(done);
    });
    afterEach((done) => {
        mockAxios.restore();
        ReactDOM.unmountComponentAtNode(document.getElementById("container"));
        document.body.innerHTML = '';
        setTimeout(done);
    });
    it('dependenciesToZoomTo default', (done) => {
        const Sink = dependenciesToZoomTo(createSink( props => {
            expect(props).toExist();
            expect(props).toEqual({ widgets: widgetsProps });
            done();
        }));
        ReactDOM.render(<Sink widgets={widgetsProps} />, document.getElementById("container"));
    });

    it('dependenciesToZoomTo triggering zoom to extent', (done) => {
        let hookRegisterProps = MapUtils.createRegisterHooks();
        const Sink = dependenciesToZoomTo(createSink(({
            hookRegister = hookRegisterProps, widgets = widgetsProps
        }) => {
            expect(hookRegister).toExist();
            const hook = hookRegister.getHook(MapUtils.ZOOM_TO_EXTENT_HOOK);
            expect(hook).toExist();
            expect(widgets).toExist();
            expect(widgets).toEqual(widgetsProps);
            done();
        }));
        hookRegisterProps.registerHook(MapUtils.ZOOM_TO_EXTENT_HOOK, {hookName: MapUtils.ZOOM_TO_EXTENT_HOOK});
        ReactDOM.render(<Sink hookRegister={hookRegisterProps} widgets={widgetsProps} updateProperty={(path) => {
            expect(path).toBe("dependencies.extentObj");
            done();
        }}/>, document.getElementById("container"));

    });
});
