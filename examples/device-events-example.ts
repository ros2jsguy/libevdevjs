
// 1. load devices from folder, e.g, /dev/input
// 2. display devices
// 3. user selects device
// 4. setup event listener for selected device and echo events to stdout
// use ctl-c to exit

import {createInterface} from 'readline';
import { Device, Evdev, Event } from "../lib/index";

const DEFAULT_DEVICE_FOLDER = '/dev/input';
const evdev = new Evdev();

function error(msg?: string) {
  throw new Error(msg);
}

function getDeviceFolder(): string {
  let args = process.argv.slice(2);
  let devFolder = 
    (args.length > 1) ?
      process.argv[1] :
      DEFAULT_DEVICE_FOLDER;

  return devFolder;
}

function displayDevices(devices: Device[]): void {
  console.log('--------------------------');
  for (let i=0; i < devices.length; i++) {
    console.log(`${i+1} - ${devices[i].toString()}`);
  }
}

function selectDeviceAndRun(cb: (idx:number)=>void): void {
  displayDevices(evdev.devices);
  const input = createInterface({input: process.stdin, output: process.stdout});
  input.question(`Select the device number 1-${evdev.devices.length}: `, response => {
    let idx: number | undefined;
    try {
      idx = parseInt(response);
    } catch(err) {}
    console.log('idxx: ', idx);
    if (idx === undefined || idx! < 0 || idx! > evdev.devices.length) {
      console.log('Error - Invalid device number selection');
      selectDeviceAndRun(cb);
    } else {
      cb(idx!);
    }
  });
}


function main(): void {
  const devFolder = getDeviceFolder();
  evdev.loadDevices(devFolder);
  if (evdev.devices.length == 0) {
    error('No devices loaded');
  }
  
  selectDeviceAndRun((idx: number) => {
    let device = evdev.devices[idx-1];
    console.log(`Watching events from device(${device.name})`);
    device.on('event', (event) => console.log('Event: ', Event.toString(event)));
    device.enableEvents(true);  
  });
  

}

main();

