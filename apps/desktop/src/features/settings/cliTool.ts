import { toast } from 'sonner';
import { ipc, type CliToolStatus } from '@/core/ipc';

export async function installCliTool(): Promise<CliToolStatus> {
  const status = await ipc.cliInstall();
  toast.success(
    `Installed at ${status.path}. Run ${status.aliasPath ? 'gmd' : 'gitmd'} --help for usage.`,
  );
  return status;
}
