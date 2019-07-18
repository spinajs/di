import { IResolveStrategy } from "./interfaces";

/**
 * Resolve strategy to initialize framework internal modules.
 */
export class FrameworkModuleResolveStrategy implements IResolveStrategy {
    public async resolve(target: any) : Promise<void> {
      if (target && target.initialize && _.isFunction(target.initialize)) {
        await target.initialize();
      }
    }
  }
  