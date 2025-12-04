import * as crypto from 'crypto'
import { machineIdSync } from 'node-machine-id';

export const getMachineId = () => {
    return machineIdSync(true);
}