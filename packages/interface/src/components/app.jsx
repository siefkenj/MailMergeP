import React, { useEffect } from "react";
import { useStoreActions, useStoreState } from "easy-peasy";
import { TabStrip, Tab } from "./common";
import { DataTab } from "./data-tab";
import { SettingsTab } from "./settings-tab";
import { PreviewTab } from "./preview-tab";
import { AboutTab } from "./about-tab";
import { SendDialog } from "./send-dialog";
import icon from "../../../thunderbird-extension/public/skin/icon64.png";

export default function App() {
    const strings = useStoreState((state) => state.locale.strings);

    const initialise = useStoreActions((actions) => actions.initialise);
    useEffect(() => {
        initialise();
    }, [initialise]);
    const maxTab = 2;
    const nextTab = useStoreActions((actions) => actions.tabs.nextTab);
    const prevTab = useStoreActions((actions) => actions.tabs.prevTab);
    const currTab = useStoreState((state) => state.tabs.currTab);
    const setTab = useStoreActions((actions) => actions.tabs.setTab);
    const cancel = useStoreActions((actions) => actions.cancel);
    const sendEmails = useStoreActions((actions) => actions.sendEmails);

    const prefs = useStoreState((state) => state.prefs);
    const parseSpreadsheet = useStoreActions(
        (actions) => actions.parseSpreadsheet
    );
    useEffect(() => {
        parseSpreadsheet();
    }, [prefs.fileName, parseSpreadsheet]);

    return (
        <>
            <header className="panel-section panel-section-header">
                <div className="icon-section-header">
                    <img className="mailmergep-icon" src={icon} alt="Mail Merge P Icon" />
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
            <SendDialog />
            <footer className="panel-section panel-section-footer">
                <button
                    className="panel-section-footer-button browser-style"
                    onClick={() => cancel()}
                >
                    {strings.cancel} <i className="far fa-times-circle fa-fw" />
                </button>
                <div className="panel-section-footer-spacer" />
                <button
                    className="panel-section-footer-button browser-style"
                    onClick={() => prevTab()}
                    style={{ opacity: currTab === 0 ? 0 : 1 }}
                    tabIndex={currTab === 0 ? -1 : undefined}
                >
                    <i className="fas fa-arrow-left fa-fw" /> {strings.previous}
                </button>
                <div className="panel-section-footer-separator" />
                {currTab < maxTab && (
                    <button
                        className="panel-section-footer-button default browser-style"
                        onClick={() => nextTab()}
                    >
                        {strings.next}{" "}
                        <i className="fas fa-arrow-right fa-fw" />
                    </button>
                )}
                {currTab === maxTab && (
                    <button
                        className="panel-section-footer-button default browser-style"
                        onClick={() => sendEmails()}
                    >
                        {strings.send}{" "}
                        <i className="far fa-paper-plane fa-fw" />
                    </button>
                )}
            </footer>
        </>
    );
}
