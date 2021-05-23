
import {Evdev, Device, Event, InputCodes} from '../lib/index';

let path = '';
path = '/dev/input/by-path/platform-fd500000.pcie-pci-0000:01:00.0-usb-0:1.1:1.0-joystick';
path = '/dev/input/event0';
// path = '/dev/input/js0';
path = '/dev/input/by-path/platform-fd500000.pcie-pci-0000:01:00.0-usb-0:1.1:1.0-event-joystick';


const evdev = new Evdev();
evdev.loadDevices('/dev/input');
console.log('devices loaded: ', evdev.devices.length);
for (const device of evdev.devices) {
  console.log('  ', device.name, device.phys);
}

console.log('find devices with capability(3)', evdev.findDevicesWithCapability(3).map(device=>device.toString()));
console.log('find devices with capability(3,1)', evdev.findDevicesWithCapability(3,1).map(device=>device.toString()));
console.log('device with led:', evdev.findDevicesWithCapability('EV_LED').toString());

const device = evdev.openDevice(path);

console.log('device name:', device.name);
console.log('device phys:', device.phys);
console.log('device uniq:', device.uniq);

console.log('device capabilities:', JSON.stringify(device.capabilities,undefined,2));

console.log('Waiting for events.');
device.enableEvents(true);
device.publishTypedEvents(true);
device.on('event', (event: Event) => console.log('Event:', event));
device.on('EV_ABS', (event: Event) => console.log('EV_ABS:', event));
// setTimeout( () => {
//   device.close();
// }, 30000);

console.log('Searching for LED devices');
let ledDevices = evdev.findDevicesWithCapability('EV_LED');
if (ledDevices.length > 0) {
  let ledDevice = ledDevices[0];
  ledDevice.enableEvents(true);
  // ledDevice.publishTypedEvents(true);
  ledDevice.on('event', (event: Event) => console.log('LED Event:', event));
  console.log('Waiting for LED devce events: ', ledDevice.toString());
} else {
  console.log('NO LED DEVICES');
}