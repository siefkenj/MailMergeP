/*
 * Common interface components
 */

import React, { useRef, useState } from "react";
import classNames from "classnames";

function TabStrip({ children, currTab, setTab }) {
    // make a tabstrip consisting of children with a tab spacer inbtween
    // connect a click listener to each <Tab />
    let tabstrip = [];
    let tabcontents = null;
    React.Children.forEach(children, (tab, key) => {
        // save the contents of the selected tag for later
        if (key === currTab) {
            tabcontents = tab.props.children;
        }
        // prepare the tab, setting it's "label" attribute as its children
        let newtab = React.cloneElement(tab, {
            children: tab.props.label,
            key: key,
            selected: key === currTab,
            onclick: e => {
                e.preventDefault();
                setTab(key);
            }
        });
        tabstrip.push(newtab);
        tabstrip.push(
            <div className="panel-section-tabs-separator" key={"s" + key} />
        );
    });
    tabstrip.pop();

    return (
        <>
            <div className={["panel-section-tabs"]}>{tabstrip}</div>
            <div className="panel-section panel-section-body">
                {tabcontents}
            </div>
        </>
    );
}

function Tab({ children, selected, onclick }) {
    const classes = {
        "panel-section-tabs-button": true,
        selected: selected
    };
    return (
        <div className={classNames(classes)} onClick={onclick}>
            {children}
        </div>
    );
}

function ClearableInput(props) {
    let { value, onChange, className, ...otherProps } = props;
    const [localValue, setLocalValue] = useState(value);
    onChange = onChange || function() {};
    const inputRef = useRef();

    function clearClicked() {
        setLocalValue("")
        onChange("");
        inputRef.current.focus();
    }
    function inputChangeEvent(e) {
        // Only allow numbers, hyphen, comma and period
        const re = /^[\d-,.]+$/;

        // Update local state if value is blank or matches the regex
        if (e.target.value === '' || re.test(e.target.value)) {
           setLocalValue(e.target.value);
        }
    }
    // Update global state when input loses focus
    function inputBlurEvent(e) {
        onChange(e.target.value);
    }

    return (
        <div className="browser-style form-group">
            <input
                className={className + " form-control"}
                type="text"
                value={localValue}
                onChange={inputChangeEvent}
                onBlur={inputBlurEvent}
                ref={inputRef}
                {...otherProps}
            />
            {localValue && (
                <span className="form-control-feedback" onClick={clearClicked}>
                    <i className="fas fa-times-circle" />
                </span>
            )}
        </div>
    );
}

// helper function to read a file (from an input)
// using a promise
async function readFile(file) {
    return new Promise((resolve, reject) => {
        var fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result);
        };
        fr.readAsArrayBuffer(file);
    });
}

function ClearableFileInput(props) {
    // if an `id` prop is passed in, it gets assigned
    // to the file input. That way a label with "for=..."
    // will attach to it instead of the display input
    let { accept, onChange, className, id, filename, ...otherProps } = props;
    onChange = onChange || function() {};
    //const [filename, setFilename] = useState("")
    const inputRef = useRef();
    const fileRef = useRef();

    function openClicked(e) {
        if (e) {
            e.preventDefault();
        }
        fileRef.current.click();
    }
    async function fileChanged(e) {
        const file = fileRef.current.files[0];
        if (!file) {
            return;
        }
        //setFilename(file.name);
        let dat = await readFile(file);
        dat = new Uint8Array(dat);
        onChange({ name: file.name, data: dat });
    }
    function clearClicked() {
        //setFilename("");
        onChange({ name: null, data: null });
        inputRef.current.focus();
    }
    function inputKeyDown(e) {
        if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault();
            openClicked();
        }
    }
    function inputClicked(e) {
        // if no file is loaded, a click
        // will open the file dialog
        if (!filename) {
            openClicked();
        }
    }

    return (
        <div className="browser-style form-group">
            <input
                type="file"
                accept={accept}
                style={{ display: "none" }}
                id={id}
                ref={fileRef}
                onChange={fileChanged}
            />
            <span
                className="form-control-feedback-prefix"
                onClick={openClicked}
            >
                <i className="fas fa-folder-open" />
            </span>
            <input
                className={className + " form-control form-control-prefix"}
                style={{ caretColor: "transparent" }}
                type="text"
                value={filename}
                onChange={function() {}}
                onKeyDown={inputKeyDown}
                onClick={inputClicked}
                ref={inputRef}
                {...otherProps}
            />
            {filename && (
                <span className="form-control-feedback" onClick={clearClicked}>
                    <i className="fas fa-times-circle" />
                </span>
            )}
        </div>
    );
}

function ProgressBar(props) {
    const { min = 0, max = 1, progress: _progress } = props;
    const range = max - min;
    if (_progress == null) {
        // If we passed in a null progress, use the default "waiting" bar
        return <progress />;
    }
    const progress = +_progress;
    return <progress max={100 * range} value={100 * (progress - min)} />;
}

export { TabStrip, Tab, ClearableInput, ClearableFileInput, ProgressBar };
