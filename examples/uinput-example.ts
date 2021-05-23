
import {Evdev, Device, Event, InputCodes} from '../lib/index';

function main(): void {
  const evdev = new Evdev();
  evdev.loadDevices('/dev/input');
  console.log('devices loaded: ', evdev.devices.length);
  
  let devices = evdev.findDevicesWithCapability('EV_KEY', 'KEY_0');
  if (devices.length === 0) {
    console.log('No EV_KEY devices');
    return;
  }

  let device = devices[0];
  console.log('Clone: ', device.toString());
  device.enableEvents(true);
  device.on('event', (event: Event) => console.log(Event.toString(event)) );
  
  let uinput = evdev.newUInputFromDevice(device);
  console.log('uinput: ', uinput.file);
  setInterval(
    () => {
      let event = Event.createEvent('EV_KEY', 'KEY_1', 1);
      console.log('Send key-0 event: ', Event.toString(event));
      uinput.writeEvent(event);
      uinput.writeSynReportEvent();
      setTimeout(() => {
        uinput.close();
        console.log('completed');
        process.exit(0);
      }, 50000);
    }, 2000);
}

main();
