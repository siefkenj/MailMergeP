import React from "react";
import ReactDOM from "react-dom";
import { StoreProvider, createStore } from "easy-peasy";

import model from "./model";
import App from "./components/app";

const store = createStore(model, { disableImmer: true });

function Root() {
    return (
        <StoreProvider store={store}>
            <App />
        </StoreProvider>
    );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<Root />, rootElement);
