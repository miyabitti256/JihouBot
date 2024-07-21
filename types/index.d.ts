export interface Reminder {
    time: string,
    content: string,
    id: number,
}

export interface Command {
    data: {
        name: string;
    };
    execute: (interaction: any) => Promise<void>;
}