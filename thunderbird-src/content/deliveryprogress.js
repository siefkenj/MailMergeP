"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

// Returns an "HH:mm:ss" formatted string
function formatTime(time) {
    function pad(x) {
        return ("" + x).padStart(2, "0");
    }

    let seconds = Math.floor(time / 1000) % 60;
    let minutes = Math.floor(time / (60 * 1000)) % 60;
    let hours = Math.floor(time / (60 * 60 * 1000));

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const elmCache = {
    time: null,
    current: null,
    total: null,
    progress: null,
    progressmeter: null,
    status: null
};

function init() {
        elmCache.time = document.getElementById("mailmerge-time");
        elmCache.status = document.getElementById("mailmerge-status");
        elmCache.total = document.getElementById("mailmerge-total");
        elmCache.progress = document.getElementById("mailmerge-progress");
        elmCache.progressmeter = document.getElementById(
            "mailmerge-progressmeter"
        );
        elmCache.current = document.getElementById("mailmerge-current");
}

/*
 * Pass in an object with any number of fields to be updated.
 */
function update(vals) {
        for (let [key, val] of Object.entries(vals)) {
            switch (key) {
                case "time":
                    elmCache.time.value = formatTime(val);
                    break;
                case "current":
                    elmCache.current.value = val + 1;
                    break;
                case "total":
                    elmCache.total.value = val;
                    break;
                case "progress":
                    elmCache.progressmeter.value = val;
                    elmCache.progress.value = val + " %";
                    break;
                case "status":
                    elmCache.status.value = val;
                    break;
                default:
                    console.warn("Unknown property to update:", key);
            }
        }
    }
