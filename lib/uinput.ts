import {EventEmitter} from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { AbsInfo, Device, DeviceLike } from "./device";
import { Event } from './event';
import { InputCodes } from './input-codes';

const evdevjs = require('bindings')('evdevjs.node') 


export interface UInput {
  readonly id: number;
  readonly file: string;
  readonly fd: number;

  writeEvent(event: Event): void;
  writeSynReportEvent(): void;

  close(): void;

  on(event: 'close', callback: (dev: Device) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
    
  removeListener(topic: 'close' | 'error', fn: any): void;
  removeAllListeners(topic?: 'close' | 'error'): void;
}

export namespace UInputFactory {

  export function createUInputFromDevice(device: Device) {
    return new UInputImpl(device);
  }
}

export class UInputImpl extends DeviceLike implements UInput {
  private _file: string | undefined;
  public toString = () => `Uinput`;

  constructor(device: Device) {
    super();
  
    let fd = evdevjs.CreateUInputFromDevice(device.id, this.id);
    console.log('fd:', fd);
    // if (!fd || fd < 0) throw new Error('Unable to create uinput from device');
    this.fd = fd;
    this.update();
  }

  get file(): string {
    const result = evdevjs.GetDevNodeForUInput(this.id);
    return result ?? '';
  }
  
  set file(file: string) {
    // nop
  }

  writeEvent(event: Event): void {
    evdevjs.UInputWriteEvent(this.id, event);
  }

  writeSynReportEvent(): void {
    this.writeEvent(Event.createEvent('EV_SYN', 'SYN_REPORT', 0));
  }

  close(): void {
    evdevjs.ReleaseUInput(this.id);
    this.emit('close', this);
    this.removeAllListeners();
  }

  protected update(): void {}

}