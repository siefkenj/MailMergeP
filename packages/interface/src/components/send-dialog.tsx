import classNames from "classnames";
import { ProgressBar } from "./common";
import { useStoreActions, useStoreState } from "../hooks/storeHooks";

function SendDialog() {
    const { progress, total, current, time, status, abort } = useStoreState(
        (state) => state.sendDialog
    );
    const open = useStoreState((state) => state.sendDialog.open);

    const cancel = useStoreActions((state) => state.sendDialog.cancel);

    const strings = useStoreState((state) => state.locale.strings);

    if (!open) {
        return null;
    }

    return (
        <div id="send-dialog">
            <div className="dialog-inner">
                <div>
                    <div className="caption">
                        <div>
                            {strings.current} {current} ({strings.total} {total}
                            )
                        </div>
                        <div>
                            {strings.time} {time}
                        </div>
                        <div>
                            {strings.status} {status}
                        </div>
                    </div>
                    <div className="progress">
                        <ProgressBar progress={abort ? null : progress} />
                    </div>
                </div>
                <div>
                    <button
                        className={classNames(
                            "panel-section-footer-button browser-style",
                            { default: abort }
                        )}
                        onClick={() => cancel()}
                    >
                        {strings.cancel}{" "}
                        <i className="far fa-times-circle fa-fw" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export { SendDialog };
