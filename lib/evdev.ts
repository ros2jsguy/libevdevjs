
import * as fs from 'fs';
import * as path from 'path';
import {Device, DeviceFactory} from './device';
import {InputCodes} from './input-codes';
import { UInput, UInputFactory } from './uinput';

type CloseDeviceCallbackFn = (device: Device) => void;
type CloseUInputCallbackFn = (uinput: UInput) => void;

class Evdev {

  private _devices: Device[];
  private _uinputs: UInput[];
  private _closeDeviceFn: CloseDeviceCallbackFn;
  private _closeUInputFn: CloseUInputCallbackFn;


  constructor() {
    this._devices = [];
    this._closeDeviceFn = (device: Device) => this.removeDevice(device);

    this._uinputs = [];
    this._closeUInputFn = (uinput: UInput) => this.removeUInput(uinput);
  }

  loadDevices(dirPath: string, filter?: RegExp | ((file: string)=>boolean)): Device[] {
    const files = 
      fs
        .readdirSync(dirPath, {withFileTypes: true})
        .filter((entry: fs.Dirent) => entry.isCharacterDevice())
        .map((entry: fs.Dirent) => path.join(dirPath, entry.name));

    for (const file of files) {
      try {
        this.openDevice(file);
      } catch(err: any) {
      }
    };

    return this.devices;
  }

  openDevice(filePath: string): Device {
    const device = DeviceFactory.create(filePath);
    this._devices.push(device);
    device.on('close', (device: Device) => this.removeDevice(device))
    return device;
  }

  newDevice(): Device {
    const device = DeviceFactory.create();
    this._devices.push(device);
    device.on('close', (device: Device) => this.removeDevice(device))
    return device;
  }

  get devices(): Device[] {
    // collect only device that have a name
    return this._devices.filter(device => typeof device.name === 'string' && device.name.length > 0);
  }

  findDevicesWithCapability(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code?: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME): Device[] {
    return this.devices.filter(device => device.hasCapability(type,code));
  }

  newUInputFromDevice(device: Device): UInput {
    const uinput = UInputFactory.createUInputFromDevice(device);
    this._uinputs.push(uinput);
    uinput.on('close', (uinput: UInput) => this.removeUInput(uinput));
    return uinput;
  }

  close(): void {
    this._devices.forEach(device => {
      device.close();
    });
    this._devices = [];
  }

  protected removeDevice(device: Device): void {
    const idx = this._devices.indexOf(device);
    if (idx > -1) {
      this._devices.splice(idx, 1);
    }
    device.removeListener('close', this._closeDeviceFn);
  }

  protected get deviceCloseCallback(): CloseDeviceCallbackFn {
    return this._closeDeviceFn;
  }

  protected removeUInput(uinput: UInput): void {
    const idx = this._uinputs.indexOf(uinput);
    if (idx > -1) {
      this._devices.splice(idx, 1);
    }
    uinput.removeListener('close', this._closeDeviceFn);
  }

  protected get uinputCloseCallback(): CloseUInputCallbackFn {
    return this._closeUInputFn;
  }
}



export {Evdev};
