
import {EventEmitter} from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Event } from './event';
import {InputCodes} from "./input-codes";

const evdevjs = require('bindings')('evdevjs.node') 

const DEVICE_FILE_ACCESS_MODE = fs.constants.R_OK;
const ARCH = process.arch.indexOf('64') >= 0 ? 64 : 32;

export const DEVICE_PROP = {
  "INPUT_PROP_POINTER": 0x00, /* needs a pointer */
  "INPUT_PROP_DIRECT": 0x01,  /* direct input devices */
  "INPUT_PROP_BUTTONPAD": 0x02, /* has button(s) under pad */
  "INPUT_PROP_SEMI_MT": 0x03, /* touch rectangle only */
  "INPUT_PROP_TOPBUTTONPAD": 0x04, /* softbuttons at top of pad */
  "INPUT_PROP_POINTING_STICK": 0x05, /* is a pointing stick */
  "INPUT_PROP_ACCELEROMETER": 0x06  /* has accelerometer */
} as const;

export type DEVICE_PROP_NAME = keyof typeof DEVICE_PROP;
export type DEVICE_PROP_CODE = typeof DEVICE_PROP[DEVICE_PROP_NAME];


export type AbsInfo = {
  value: number;
  min: number;
  max: number;
  fuzz: number;
  flat: number;
  resolution: number;
}

export type EventDescriptor = {
  code: number;
  absInfo?: AbsInfo;
}

export declare interface Capability {
  type: number;
  events: EventDescriptor[];
}

export declare interface Device {
  readonly id: number;
  readonly file: string;
  readonly fd: number;
  name: string;
  phys: string;
  uniq: string;
  bustype: number;
  vendor: number;
  product: number;
  version:number;

  readonly properties: number[];
  hasProperty(property: DEVICE_PROP_CODE | DEVICE_PROP_NAME): boolean;
  
  readonly capabilities: Capability[];
  hasCapability(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code?: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME): boolean;
  
  readonly grabbed: boolean;
  grab(): boolean;
  ungrab(): boolean

  enableEvents(enabled: boolean): void;
  enableEventType(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, enabled?: boolean): void;
  enableEventCode(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME, enabled?: boolean): void
  areEventsEnabled(): boolean;
  publishTypedEvents(enabled: boolean): void;
  isPublishTypedEvents(): boolean;

  close(): void;

  on(event: 'close', callback: (dev: Device) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on<T extends InputCodes.EV_TYPE_NAME | 'event'>(topic: T, callback: (event: Event) => void): void;

  removeListener(topic: InputCodes.EV_TYPE_NAME | 'event' | 'close' | 'error', fn: any): void;
  removeAllListeners(topic?: InputCodes.EV_TYPE_NAME | 'event' | 'close' | 'error'): void;
}

export namespace DeviceFactory {

  export function create(path?: string): Device {
    return new DeviceImpl(path);
  }

  export function isDeviceFile(path: string) {
    let result = false;
    try {
      const fd = fs.openSync(path, DEVICE_FILE_ACCESS_MODE);
      const stat = fs.fstatSync(fd);
      result = stat.isCharacterDevice();
    } catch(err) {
      // do nothing
    }

    return result;
  }
}

export abstract class DeviceLike extends EventEmitter {
  private static ID = 1;

  private _id: number;
  protected _fd: number = 0;

  constructor() {
    super();
    this._id = DeviceLike.ID++;
  }

  get id(): number {
    return this._id;
  }

  abstract get file(): string;
  abstract set file(file: string);
  protected abstract update(): void;

  public hasFile(): boolean {
    return !this.file;
  }

  get fd(): number {
    return this._fd ?? -1;
  }

  set fd(fd: number) {
    if (this._fd) throw new Error('Device file descriptor may not be redefined');

    this._fd = fd;
  }

  hasFd(): boolean {
    return this.fd > 0;
  }

  protected handleError(err: Error): void {
    this.emit("error", err);
  }
}

export class DeviceImpl extends DeviceLike implements Device {
  
  private _eventsEnabled: boolean;
  private _publishTypedEvents: boolean;
  private _capabilities: Capability[] | undefined;
  private _deviceInfo: any;
  private _grabbed: boolean;
  private _file: string | undefined;
  private _stream: fs.ReadStream | undefined;

  public toString = () => `Device {name: ${this.name}, file: ${this.file}}`;

  constructor(file?: string) {
    super();

    this._grabbed = false;
    this._eventsEnabled = false;
    this._publishTypedEvents = false;
    this._deviceInfo = newDeviceInfo();

    evdevjs.NewLibevdev(this.id);
    
    this._file = file;
    if (file) {
      this.update();
    }
  }

  get file(): string {
    return this._file ?? '';
  }

  set file(file: string) {
    if (this._file) throw new Error('Device file may not be redefined');
    if (!file || file.length < 0) throw new Error('Device file must be a valid filename');

    this._file = file;
    if (this.hasFile()) {
      this.update();
    }
  }

  protected update(): void {
    this.fd = fs.openSync(this.file, 'r');

    const options = {
      fd: this.fd,
      flags: 'r+',
      autoClose: true
    };
    
    try {
      this._stream = fs.createReadStream(this.file, options);
    } catch(err) {
      options.flags = 'r';
      this._stream =fs.createReadStream(this.file, options);
    }
    this._stream.on("error", (err) => this.handleError(err));
 
    evdevjs.SetFD(this.id, this.fd);

    try {
      this._deviceInfo = evdevjs.GetDeviceInfo(this.id);
    } catch(e){
      this.emit("error",new Error("in Reader init : "+e));
    }
  }

  get name(): string {
    return this._deviceInfo.name ?? '';  
  }

  set name(name: string) {
    this._deviceInfo.name = name;
  }

  get phys(): string {
    return this._deviceInfo.phys ?? '';
  }

  set phys(phys: string) {
    this._deviceInfo.phys = phys;
  }

  get uniq(): string {
    return this._deviceInfo.uniq ?? '';
  }

  set uniq(uniq: string) {
    this._deviceInfo.uniq = uniq;
  }

  get bustype(): number {
    return this._deviceInfo.bustype;  
  }

  set bustype(bustype: number) {
    this._deviceInfo.bustype = bustype;
  }

  get vendor(): number {
    return this._deviceInfo.vendor;  
  }

  set vendor(vendor: number) {
    this._deviceInfo.vendor = vendor;
  }

  get product(): number {
    return this._deviceInfo.product;  
  }

  set product(product: number) {
    this._deviceInfo.product = product;
  }

  get version(): number {
    return this._deviceInfo.version;  
  }

  set version(version: number) {
    this._deviceInfo.version = version;
  }

  enableEventType(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, enabled=true): void {
    let typeCode = type;
    if (typeof type === 'string') {
      typeCode = InputCodes.getType(type);
    }

    evdevjs.EnableEventType(this.id, typeCode, enabled);
  }

  enableEventCode(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME, enabled=true): void {
    let typeCode = type;
    if (typeof type === 'string') {
      typeCode = InputCodes.getType(type);
    }
    
    let codeNum = typeof code === 'string' ?
          InputCodes.getCode(code as InputCodes.EV_CODE_NAME) as InputCodes.EV_CODE : code;

    evdevjs.EnableEventCode(this.id, typeCode, codeNum, enabled);

  }

  get properties(): number[] {
    return Object.values(DEVICE_PROP).filter(code => this.hasProperty(code));
  }

  enableProperty(property: DEVICE_PROP_CODE | DEVICE_PROP_NAME, enabled=true) {
    let code = property;
    if (typeof property === 'string') {
      code = DEVICE_PROP[property];
    }

    evdevjs.EnableProperty(this.id, code, enabled);
  }

  hasProperty(property: DEVICE_PROP_CODE | DEVICE_PROP_NAME): boolean {
    let propertyCode = property;
    if (typeof propertyCode === 'string') {
      propertyCode = DEVICE_PROP[propertyCode];
    }
    return evdevjs.HasProperty(this.id, propertyCode);
  }

  get capabilities(): Capability[] {
    if (this._capabilities) return this._capabilities;
    
    this._capabilities = this.loadCapabilities();
    return this._capabilities;
  }

  hasCapability(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code?: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME): boolean {
    let typeCode = type;
    if (typeof type === 'string') {
      typeCode = InputCodes.getType(type);
    }
    const hasType = evdevjs.HasType(this.id, typeCode);
    if (!hasType || !code) return hasType;
    
    let codeNum = typeof code === 'string' ?
          InputCodes.getCode(code as InputCodes.EV_CODE_NAME) as InputCodes.EV_CODE : code;

    return evdevjs.HasCode(this.id, typeCode, codeNum);
  }

  get grabbed(): boolean {
    return this._grabbed;
  }

  grab(): boolean {
    let result = evdevjs.Grab(this.id, true);
    if (result) {
      this._grabbed = true;
    }
    return result;
  }

  ungrab(): boolean {
    let result = evdevjs.Grab(this.id, false);
    if (result) {
      this._grabbed = false;
    }
    return result;
  }

  enableEvents(enabled = true): void {
    // nop if enabled unchanged
    if (this._eventsEnabled === enabled) return;

    this._eventsEnabled = enabled;
    if (this._stream) {
      if (enabled) {
        this._stream!.on('readable', () => this.readAndProcessEvents());
      } else {
        this._stream!.removeAllListeners('readable');
      }
    }
  }

  areEventsEnabled(): boolean {
    return this._eventsEnabled;
  }

  publishTypedEvents(enabled: boolean): void {
    this._publishTypedEvents = enabled;
  }

  isPublishTypedEvents(): boolean {
    return this._publishTypedEvents;
  }

  close(): void {
    this.enableEvents(false);
    evdevjs.ReleaseLibevdev(this.id);
    
    if (this._stream) {
      try {
        this._stream.close();
        this._stream.removeAllListeners();
        this._stream = undefined;
        this._fd = -1;
      } catch(err) {
        // do nothing
      }

      this.emit('close', this);
      this.removeAllListeners();
    }
  }

  protected readAndProcessEvents(): void {
    // native call to retrieve the next event
    this.publishEvent(evdevjs.NextEvent(this.id));
  }

  /**
   * Publish an event either raw via "event", or with it's type code as event name.
   * @param  {[type]} event
   */
  publishEvent(event: Event): void {
    if (this.isPublishTypedEvents()) {
      const typeName = InputCodes.getTypeName(event.type);
      if (typeName) {
        this.emit(typeName, event);
      }
    } else {
        this.emit('event', event);
      }
  };

  protected loadCapabilities(): Capability[] {
    let capabilities: Capability[] = [];
    return capabilities;
  }
}

function newDeviceInfo() {
  return {
    name: undefined,
    phys: undefined,
    uniq: undefined,
    bustype: 0,
    vendor: 0,
    product: 0,
    version: 0
  };
}