/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import PropTypes from 'prop-types';

import React from 'react';
import './css/formControlIntl.css';
import NumericInput from '../../libs/numeric-input/NumericInput';
/**
 * Localized Numeric Input. It provides an numeric input value that uses
 * separators (eg. ",",".") as they are used in the current selected language from context.
 * @prop {string|number} value a numeric value
 * @prop {string|number] defaultValue a value to use as default
 * @prop {function} onChange handler of change event. the argument of this handler is the current value inserted.
 * @prop {number} step the step when you click on arrows (up, down) of the input
 * @prop {function} onBlur event handler on blur event
 */
class IntlNumberFormControl extends React.Component {

    static propTypes = {
        type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        onChange: PropTypes.func,
        step: PropTypes.number,
        locale: PropTypes.string,
        disabled: PropTypes.bool,
        onBlur: PropTypes.func
    }

    static contextTypes = {
        intl: PropTypes.object
    };
    constructor(props) {
        super(props);
        this.state = {
            inputRef: null
        };
        this.value = '';
    }

    render() {
        const {onChange, onBlur, disabled, type, step, value, defaultValue,
            ...formProps} = this.props;
        return (
            <NumericInput
                id={'intl-numeric'}
                step={step}
                {...formProps}
                {...value !== undefined ? {value: this.format(value) } : {defaultValue: this.format(defaultValue)}}
                format={this.format}
                onChange={(val) => {
                    val === null ? this.props.onChange("") : this.props.onChange(val.toString());
                }}
                onKeyUp={ev=>{
                    const currentValue = ev.target.value || "";
                    const prevValue = this.value || "";
                    // update cursor position in case adding/deleting numbers at the middle of the current input value
                    if (prevValue !== currentValue) {
                        this.value = currentValue;      // set value
                        const locale = this.context && this.context.intl && this.context.intl.locale || "en-US";
                        const formatParts = new Intl.NumberFormat(locale).formatToParts(10000.1);
                        const groupSeparator = formatParts?.find(part => part.type === 'group').value;
                        let isFormattedCurrentVal = currentValue && groupSeparator && (currentValue.includes(groupSeparator));
                        let isFormattedPrevVal = prevValue && groupSeparator && (prevValue.includes(groupSeparator));
                        if (isFormattedCurrentVal || isFormattedPrevVal) {
                            const currentCursorPos = ev.target.selectionStart;
                            let prevValueLength = prevValue.length;
                            let currentValueLength = currentValue.length;
                            let numGrSeparatorInPrevValue = prevValue.length - prevValue.replaceAll(groupSeparator, "").length;
                            let numGrSeparatorInCurrentValue = currentValue.length - currentValue.replaceAll(groupSeparator, "").length;
                            if (currentValueLength - prevValueLength === 2 && numGrSeparatorInPrevValue < numGrSeparatorInCurrentValue) {
                                return ev.target.setSelectionRange(currentCursorPos + 1, currentCursorPos + 1 );
                            } else if (currentValueLength - prevValueLength === 1 && numGrSeparatorInPrevValue === numGrSeparatorInCurrentValue) {
                                return ev.target.setSelectionRange(currentCursorPos, currentCursorPos );
                            } else if (prevValueLength - currentValueLength === 2 && numGrSeparatorInPrevValue > numGrSeparatorInCurrentValue) {
                                return ev.target.setSelectionRange(currentCursorPos - 1, currentCursorPos - 1 );
                            } else if (prevValueLength - currentValueLength === 1 && numGrSeparatorInPrevValue === numGrSeparatorInCurrentValue) {
                                return ev.target.setSelectionRange(currentCursorPos, currentCursorPos );
                            }
                        }

                    }
                    let isDelete = ev.keyCode === 8 || ev.keyCode === 46;       // delete by delete key or backspace key
                    // move the cursor of adding number at the end of input
                    if (![37, 39, 17].includes(ev.keyCode) && !isDelete && ev.target.selectionStart === ev.target.value.length - 1) {
                        return ev.target.setSelectionRange(-1, -1);
                    }
                    return true;
                }}
                onBlur={e=>{
                    let val = e.target.value;
                    if (onBlur) {
                        e.target.value = this.parse(val);
                        onBlur(e);
                    }
                }}
                disabled={disabled || false}
                onFocus={(e) =>{
                    // save input ref into state to enable getting/updating selection range [input cursor position]
                    if (!this.state.inputRef) {
                        this.setState({ inputRef: e.target });
                        return;
                    }
                    return;
                }}
                parse={this.parse}
                onKeyPress={e => {
                    const allow = e.key.match(/^[a-zA-Z]*$/);
                    allow !== null && e.preventDefault();
                }}
                componentClass={"input"}
                className="form-control intl-numeric"
            />
        );
    }

    parse = value => {
        let formatValue = value;
        // eslint-disable-next-line use-isnan
        if (formatValue !== NaN && formatValue !== "NaN") {  // Allow locale string to parse
            const locale = this.context && this.context.intl && this.context.intl.locale || "en-US";
            const format = new Intl.NumberFormat(locale);
            const parts = format.formatToParts(12345.6);
            const numerals = Array.from({ length: 10 }).map((_, i) => format.format(i));
            const index = new Map(numerals.map((d, i) => [d, i]));
            const group = new RegExp(
                `[${parts.find(d => d.type === "group").value}]`,
                "g"
            );
            const decimal = new RegExp(
                `[${parts.find(d => d.type === "decimal").value}]`
            );
            const numeral = new RegExp(`[${numerals.join("")}]`, "g");
            const rIndex = d => index.get(d);

            formatValue = (formatValue
                .trim()
                .replace(group, "")
                .replace(decimal, ".")
                .replace(numeral, rIndex));
            return formatValue ? +formatValue : NaN;
        }
        return "";
    };

    format = val => {
        if (!isNaN(val) && val !== "NaN") {
            const locale = this.context && this.context.intl && this.context.intl.locale || "en-US";
            const formatter = new Intl.NumberFormat(locale, {minimumFractionDigits: 0, maximumFractionDigits: 20});
            return formatter.format(val);
        }
        return "";
    };
}

export default IntlNumberFormControl;
