import { App, Command, CommandParams } from "../types";

export abstract class CommandBase implements Command {
    protected _app: App;

    abstract name: string;
    abstract description: string;

    constructor(app: App) {
        this._app = app;
    }

    abstract execute(config: CommandParams): Promise<void>;
}