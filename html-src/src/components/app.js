import React, { useEffect } from "react";
import { useAction, useStore } from "easy-peasy";
import { TabStrip, Tab } from "./common.js";
import { DataTab } from "./data-tab.js";
import { SettingsTab } from "./settings-tab.js";
import { PreviewTab } from "./preview-tab.js";
import { AboutTab } from "./about-tab.js";
import "font-awesome/css/font-awesome.min.css";

export default function App() {
    const strings = useStore(state => state.locale.strings);

    const initialise = useAction(actions => actions.initialise);
    useEffect(() => {
        initialise();
    });
    const maxTab = 2;
    const nextTab = useAction(actions => actions.tabs.nextTab);
    const prevTab = useAction(actions => actions.tabs.prevTab);
    const currTab = useStore(state => state.tabs.currTab);
    const setTab = useAction(actions => actions.tabs.setTab);
    const cancel = useAction(actions => actions.cancel);
    const sendEmails = useAction(actions => actions.sendEmails);

    return (
        <>
            <header className="panel-section panel-section-header">
                <div className="icon-section-header">
                    <i
                        className="fas fa-mail-bulk"
                        style={{
                            fontSize: "24pt",
                            color: "rgba(97, 181, 255, 0.75)"
                        }}
                    />
                </div>
                <div className="text-section-header">Mail Merge</div>
            </header>
            <TabStrip currTab={currTab} setTab={setTab}>
                <Tab
                    label={
                        <>
                            <i className="fas fa-table fa-fw" /> {strings.data}
                        </>
                    }
                >
                    <DataTab />
                </Tab>
                <Tab
                    label={
                        <>
                            <i className="fas fa-cogs fa-fw" />{" "}
                            {strings.settings}
                        </>
                    }
                >
                    <SettingsTab />
                </Tab>
                <Tab
                    label={
                        <>
                            <i className="fas fa-address-card fa-fw" />{" "}
                            {strings.preview}
                        </>
                    }
                >
                    <PreviewTab />
                </Tab>
                <Tab
                    label={
                        <>
                            <i className="fas fa-question-circle fa-fw" />{" "}
                            {strings.about}
                        </>
                    }
                >
                    <AboutTab />
                </Tab>
            </TabStrip>
            <div style={{ height: "100px" }} />
            <footer className="panel-section panel-section-footer">
                <button
                    className="panel-section-footer-button browser-style"
                    onClick={cancel}
                >
                    {strings.cancel} <i className="far fa-times-circle fa-fw" />
                </button>
                <div className="panel-section-footer-spacer" />
                <button
                    className="panel-section-footer-button browser-style"
                    onClick={prevTab}
                    style={{ opacity: currTab === 0 ? 0 : 1 }}
                    tabIndex={currTab === 0 ? -1 : undefined}
                >
                    <i className="fas fa-arrow-left fa-fw" /> {strings.previous}
                </button>
                <div className="panel-section-footer-separator" />
                {currTab < maxTab && (
                    <button
                        className="panel-section-footer-button default browser-style"
                        onClick={nextTab}
                    >
                        {strings.next}{" "}
                        <i className="fas fa-arrow-right fa-fw" />
                    </button>
                )}
                {currTab === maxTab && (
                    <button
                        className="panel-section-footer-button default browser-style"
                        onClick={sendEmails}
                    >
                        {strings.send}{" "}
                        <i className="far fa-paper-plane fa-fw" />
                    </button>
                )}
            </footer>
        </>
    );
}