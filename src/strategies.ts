import * as _ from "lodash";
import { IStrategy } from "./interfaces";

/**
 * Resolve strategy to initialize framework internal modules.
 */
export class FrameworkModuleStrategy implements IStrategy {
    public resolve(target: any): Promise<void> | void {
        if (target && target.initialize && _.isFunction(target.initialize)) {
            return new Promise((res, _) => {
                res(target.initialize());
            });
        }
    }
}
