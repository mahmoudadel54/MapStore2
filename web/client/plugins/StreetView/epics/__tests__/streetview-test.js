import expect from 'expect';
import { testEpic, addTimeoutEpic, TEST_TIMEOUT } from '../../../../epics/__tests__/epicTestUtils';
import { CONTROL_NAME } from '../../constants';

import { UPDATE_ADDITIONAL_LAYER } from '../../../../actions/additionallayers';
import { setControlProperty } from '../../../../actions/controls';

import { streetViewSyncLayer, streetViewSetupTearDown } from '../streetView';
import { setPov, setLocation, updateStreetViewLayer } from '../../actions/streetView';
import {REGISTER_EVENT_LISTENER, ZOOM_TO_EXTENT} from '../../../../actions/map';

describe('StreetView epics', () => {
    it('update layer on setLocation', (done) => {
        let action = setLocation({});
        const NUM_ACTIONS = 1;
        const LAT = 1;
        const LNG = 2;
        testEpic(streetViewSyncLayer, NUM_ACTIONS, action, ([update]) => {
            expect(update).toExist();
            expect(update.type).toBe(UPDATE_ADDITIONAL_LAYER);
            expect(update.options.features[0].geometry.coordinates).toEqual([LNG, LAT, 0]);
            done();
        }, {streetView: {location: {latLng: {lat: LAT, lng: LNG}}}});
    });
    it('update layer on setPov', (done) => {
        let action = setPov({});
        const NUM_ACTIONS = 1;
        const LAT = 1;
        const LNG = 2;
        const rotation = 42;
        testEpic(streetViewSyncLayer, NUM_ACTIONS, action, ([update]) => {
            expect(update).toExist();
            expect(update.type).toBe(UPDATE_ADDITIONAL_LAYER);
            expect(update.options.features[0].geometry.coordinates).toEqual([LNG, LAT, 0]);
            done();
        }, {streetView: {pov: {heading: rotation}, location: {latLng: {lat: LAT, lng: LNG}}}});
    });
    it('prevent layer to be updated if location is not set', (done) => {
        let action = setPov({});
        const NUM_ACTIONS = 1;
        testEpic(addTimeoutEpic(streetViewSyncLayer, 50), NUM_ACTIONS, action, ([timeout]) => {
            expect(timeout).toExist();
            expect(timeout.type).toBe(TEST_TIMEOUT);
            done();
        }, {layers: {flat: [{name: "layerName", url: "clearlyNotAUrl", visibility: true, queryable: false, type: "wms"}]}});
    });
    it('updateStreetViewLayer', (done) => {
        let action = updateStreetViewLayer({_v_: 1});
        const NUM_ACTIONS = 1;
        testEpic(streetViewSyncLayer, NUM_ACTIONS, action, ([update]) => {
            expect(update).toExist();
            expect(update.type).toBe(UPDATE_ADDITIONAL_LAYER);
            expect(update.options._v_).toEqual(1); // the update is applied to the default layer.
            done();
        });
    });
    it('streetViewSetupTearDown', (done) => {
        let action = setControlProperty(CONTROL_NAME, 'enabled', false);
        const NUM_ACTIONS = 3;
        testEpic(streetViewSetupTearDown, NUM_ACTIONS, action, ([
            register,
            updateAdditionalLayers1,
            updateAdditionalLayers2
        ]) => {
            expect(register.type).toBe(REGISTER_EVENT_LISTENER);
            expect(register.eventName).toBe('click');
            expect(register.toolName).toBe(CONTROL_NAME);
            expect(updateAdditionalLayers1.type).toBe(UPDATE_ADDITIONAL_LAYER);
            expect(updateAdditionalLayers2.type).toBe(UPDATE_ADDITIONAL_LAYER);
            done();
        }, {
            streetView: {
                location: {
                    latLng: {
                        lat: 1,
                        lng: 2
                    }
                }
            },
            controls: {
                [CONTROL_NAME]: {
                    enabled: true
                }
            }
        });
    });
    it('streetViewSetupTearDown for mapillary', (done) => {
        let action = setControlProperty(CONTROL_NAME, 'enabled', false);
        const NUM_ACTIONS = 4;
        testEpic(streetViewSetupTearDown, NUM_ACTIONS, action, ([
            zoomToExtent,
            register,
            updateAdditionalLayers1,
            updateAdditionalLayers2
        ]) => {
            expect(zoomToExtent.type).toBe(ZOOM_TO_EXTENT);
            expect(zoomToExtent.crs).toBe('EPSG:4326');
            expect(register.type).toBe(REGISTER_EVENT_LISTENER);
            expect(register.eventName).toBe('click');
            expect(register.toolName).toBe(CONTROL_NAME);
            expect(updateAdditionalLayers1.type).toBe(UPDATE_ADDITIONAL_LAYER);
            expect(updateAdditionalLayers1.options.owner).toBe('mapillaryViewer');
            expect(updateAdditionalLayers1.options.isGeojson).toBe(true);
            expect(updateAdditionalLayers2.type).toBe(UPDATE_ADDITIONAL_LAYER);
            done();
        }, {
            streetView: {
                location: {
                    latLng: {
                        lat: 1,
                        lng: 2
                    }
                },
                configuration: {
                    provider: 'mapillary',
                    providerSettings: {
                        ApiURL: "base/web/client/test-resources/mapillary/output/run_04/index.json"
                    }
                }
            },
            controls: {
                [CONTROL_NAME]: {
                    enabled: true
                }
            }
        });
    });
});
