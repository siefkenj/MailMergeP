/*
 * Common interface components
 */

import classNames from "classnames";
import React, {
    type ChangeEvent,
    type FocusEvent,
    type FocusEventHandler,
    type KeyboardEvent,
    type MouseEvent,
    type MouseEventHandler,
    type ReactElement,
    type ReactNode,
    useRef,
    useState,
} from "react";
import type { UpdatePrefEvent } from "../types/types";

type TabStripProps = {
    currTab: number;
    setTab: (tab: number) => void;
    children: ReactElement[];
};

function TabStrip({ children, currTab, setTab }: TabStripProps) {
    // make a tabstrip consisting of children with a tab spacer inbetween
    // connect a click listener to each <Tab />
    const tabstrip: ReactElement[] = [];
    let tabcontents = null;
    React.Children.forEach<ReactElement>(children, (tab, key) => {
        // save the contents of the selected tag for later
        if (key === currTab) {
            tabcontents = tab.props.children;
        }
        // prepare the tab, setting it's "label" attribute as its children
        const newtab = React.cloneElement(tab, {
            children: tab?.props.label,
            key: key,
            selected: key === currTab,
            onClick: (e: MouseEvent | FocusEvent) => {
                e.preventDefault();
                setTab(key);
            },
        });
        tabstrip.push(newtab);
        tabstrip.push(
            <div className="panel-section-tabs-separator" key={"s" + key} />
        );
    });
    tabstrip.pop();

    return (
        <>
            <div className={"panel-section-tabs"}>{tabstrip}</div>
            <div className="panel-section panel-section-body">
                {tabcontents}
            </div>
        </>
    );
}

type TabProps = {
    selected?: boolean;
    onClick?: MouseEventHandler;
    children: ReactNode;
    label: ReactElement; // Not used in Tab component, but picked up in TabStrip
};

function Tab({ children, selected, onClick }: TabProps) {
    const classes = {
        "panel-section-tabs-button": true,
        selected: selected,
    };
    return (
        <div className={classNames(classes)} onClick={onClick}>
            {children}
        </div>
    );
}

type ClearableInputProps = {
    value: string;
    id: string;
    className: string;
    onChange: (
        event: UpdatePrefEvent
    ) => void | FocusEventHandler<HTMLInputElement>;
    placeholder: string;
    title: string;
    children?: ReactNode;
};

export function ClearableInput(props: ClearableInputProps) {
    const { value, onChange = () => {}, className, ...otherProps } = props;
    const inputRef = useRef<HTMLInputElement>(null);

    // Use local state to avoid cursor jumping to end of input on changes
    const [localValue, setLocalValue] = useState(value);

    function clearClicked() {
        setLocalValue("");
        onChange({
            currentTarget: { value: "" },
        } as FocusEvent<HTMLInputElement>);
        inputRef.current?.focus();
    }

    function onChangeLocal(e: ChangeEvent<HTMLInputElement>) {
        const value = e.currentTarget.value;
        if (typeof value === "string") {
            setLocalValue(value);
        }
    }

    return (
        <div className="browser-style form-group">
            <input
                className={className + " form-control"}
                type="text"
                value={localValue}
                onChange={onChangeLocal}
                onBlur={onChange} // Update global state when input loses focus
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
async function readFile(filename: Blob) {
    return new Promise<ArrayBuffer>((resolve) => {
        const fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result as ArrayBuffer);
        };

        fr.readAsArrayBuffer(filename);
    });
}

export type FileInputOnChangeValue = {
    name: string | null;
    data: ArrayBuffer | null;
};

type ClearableFileInputProps = {
    id?: string;
    accept: string;
    onChange: ({ name, data }: FileInputOnChangeValue) => void;
    filename: string;
    placeholder: string;
    className?: string;
};

function ClearableFileInput(props: ClearableFileInputProps) {
    // if an `id` prop is passed in, it gets assigned
    // to the file input. That way a label with "for=..."
    // will attach to it instead of the display input
    const {
        accept,
        onChange = () => {},
        className,
        id,
        filename,
        ...otherProps
    } = props;
    const inputRef = useRef<HTMLInputElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    function openClicked(e?: MouseEvent) {
        if (e) {
            e.preventDefault();
        }
        fileRef.current?.click();
    }

    async function fileChanged() {
        const file = fileRef.current?.files ? fileRef.current?.files[0] : "";
        if (!file) {
            return;
        }
        let dat = await readFile(file);
        dat = new Uint8Array(dat);
        // Opening the same file, e.g. after modifying its content, will not trigger
        // useEffect with parseSpreadsheet unless there is a state change
        onChange({ name: "", data: new ArrayBuffer() });
        onChange({ name: file.name, data: dat });
    }
    function clearClicked() {
        onChange({ name: null, data: null });
        inputRef.current?.focus();
    }
    function inputKeyDown(e: KeyboardEvent) {
        if ([" ", "Enter"].includes(e.key)) {
            e.preventDefault();
            openClicked();
        }
    }
    function inputClicked() {
        // if no file is loaded, a click
        // will open the file dialog
        if (!filename) {
            openClicked();
        }
    }

    const onClickFileInput = (e: MouseEvent<HTMLInputElement>) => {
        e.currentTarget.value = "";
    };

    return (
        <div className="browser-style form-group">
            <input
                type="file"
                accept={accept}
                style={{ display: "none" }}
                id={id}
                ref={fileRef}
                onChange={fileChanged}
                // Needed to trigger onChange when opening the same file
                onClick={onClickFileInput}
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
                onChange={function () {}}
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

type ProgressBarProps = {
    min?: number;
    max?: number;
    progress: number | null | undefined;
};

function ProgressBar(props: ProgressBarProps) {
    const { min = 0, max = 1, progress: _progress } = props;
    const range = max - min;
    if (_progress == null) {
        // If we passed in a null progress, use the default "waiting" bar
        return <progress />;
    }
    const progress = +_progress;
    return <progress max={100 * range} value={100 * (progress - min)} />;
}

export { ClearableFileInput, ProgressBar, Tab, TabStrip };
