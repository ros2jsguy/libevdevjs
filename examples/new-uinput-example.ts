
// create a new Uinput from scratch
// based on the libevdev example: 
//    https://www.freedesktop.org/software/libevdev/doc/latest/group__uinput.html

import {Evdev, Device, Event, InputCodes} from '../lib/index';

function main(): void {
  const evdev = new Evdev();
  const device = evdev.newDevice();
  device.name = 'Example Device';
  device.enableEventType('EV_KEY');
  device.enableEventCode('EV_KEY', 'KEY_0');
  device.enableEventCode('EV_KEY', 'KEY_1');

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
