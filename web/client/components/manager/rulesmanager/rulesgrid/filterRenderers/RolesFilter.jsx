/**
* Copyright 2018, GeoSolutions Sas.
* All rights reserved.
*
* This source code is licensed under the BSD-style license found in the
* LICENSE file in the root directory of this source tree.
*/
import PagedCombo from '../../../../misc/combobox/PagedCombobox';

import autoComplete from '../../enhancers/autoComplete';
import { compose, defaultProps, withHandlers } from 'recompose';
import localizedProps from '../../../../misc/enhancers/localizedProps';
import { getRoles } from '../../../../../observables/rulesmanager';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { error } from '../../../../../actions/notifications';
import { filterSelector } from '../../../../../selectors/rulesmanager';
const selector = createSelector(filterSelector, (filter) => ({
    selected: filter.rolename,
    anyFieldVal: filter.groupAny
}));

export default compose(
    connect(selector, {onError: error}),
    defaultProps({
        size: 5,
        textField: "name",
        valueField: "name",
        loadData: getRoles,
        parentsFilter: {},
        filter: false,
        placeholder: "rulesmanager.placeholders.filterAny",
        checkedTooltip: "Show all eligible rules",
        unCheckedTooltip: "Filter list using selected value",
        loadingErrorMsg: {
            title: "rulesmanager.errorTitle",
            message: "rulesmanager.errorLoadingRoles"
        },
        anyFilterRuleMode: 'groupAny'
    }),
    withHandlers({
        onValueSelected: ({column = {}, onFilterChange = () => {}}) => filterTerm => {
            onFilterChange({column, filterTerm});
        }
    }),
    localizedProps(["placeholder", "loadingErroMsg", "checkedTooltip", "unCheckedTooltip"]),
    autoComplete
)(PagedCombo);
