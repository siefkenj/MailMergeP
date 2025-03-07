import ReactDOM from "react-dom/client";
import { createStore, StoreProvider } from "easy-peasy";

import { model } from "./model";
import App from "./components/app";

import "./css/browser-style.css";
import "./css/email-preview.css";
import "@fortawesome/fontawesome-free/css/all.min.css";

const store = createStore(model, { disableImmer: true });

function Root() {
    return (
        <StoreProvider store={store}>
            <App />
        </StoreProvider>
    );
}

const rootElement = document.getElementById("root");

ReactDOM.createRoot(rootElement!).render(<Root />);
