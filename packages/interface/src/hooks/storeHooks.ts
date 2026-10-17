import { createTypedHooks } from "easy-peasy";
import type { Model } from "../types/modelTypes";

const typedHooks = createTypedHooks<Model>();

export const useStoreActions = typedHooks.useStoreActions;
export const useStoreDispatch = typedHooks.useStoreDispatch;
export const useStoreState = typedHooks.useStoreState;
