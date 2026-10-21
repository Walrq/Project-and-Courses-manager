import type { CommandDef } from '../core/commandMatch';

class CommandRegistry {
  private defaultCommands: CommandDef[] = [];
  private dynamicCommands: Map<string, CommandDef> = new Map();
  private recentCommandIds: string[] = [];

  constructor() {
    try {
      const stored = localStorage.getItem('recent_command_ids');
      if (stored) {
        this.recentCommandIds = JSON.parse(stored);
      }
    } catch {
      // Ignore
    }
  }

  setDefaultCommands(commands: CommandDef[]) {
    this.defaultCommands = commands;
  }

  registerDynamicCommand(command: CommandDef): () => void {
    this.dynamicCommands.set(command.id, command);
    return () => {
      this.dynamicCommands.delete(command.id);
    };
  }

  getAllCommands(): CommandDef[] {
    return [...this.defaultCommands, ...Array.from(this.dynamicCommands.values())];
  }

  recordCommandUsage(id: string) {
    this.recentCommandIds = [id, ...this.recentCommandIds.filter((cid) => cid !== id)].slice(0, 10);
    try {
      localStorage.setItem('recent_command_ids', JSON.stringify(this.recentCommandIds));
    } catch {
      // Ignore
    }
  }

  getRecentCommandIds(): string[] {
    return this.recentCommandIds;
  }
}

export const commandRegistry = new CommandRegistry();
