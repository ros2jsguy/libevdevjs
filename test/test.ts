const evdevjs = require('bindings')('evdevjs.node') 
import * as fs from 'fs';
import {InputCodes, EV_TYPE, EV_TYPE_NAME, EV_CODE_NAME, EV_CODE} from "../lib/input-codes";

let path = '';
path = '/dev/input/by-path/platform-fd500000.pcie-pci-0000:01:00.0-usb-0:1.1:1.0-joystick';
path = '/dev/input/event0';
// path = '/dev/input/js0';
path = '/dev/input/by-path/platform-fd500000.pcie-pci-0000:01:00.0-usb-0:1.1:1.0-event-joystick';
// path = '/dev/input/jso0';

function main(): void {

  let cnt = 1;
  let _fd = fs.openSync(path, 'r');
  const _stream = 
    fs.createReadStream(
      path,
      {
        fd: _fd,
        flags: 'r',
        autoClose: true
      })
    // setup listeners on stream
    .on("error", (err) => console.error(err))
    .on('readable', (_: any) => {
      cnt++;
      let event = evdevjs.NextEvent(_fd);
      console.log(cnt, 'event:', event);
    });

    let deviceInfo = evdevjs.NewLibevdev(_fd);
    console.log('devinfo:', deviceInfo);

    console.log('stream created');

    console.log('capabilities:', evdevjs.GetCapabilities(_fd));

    console.log('typeName: ', InputCodes.getTypeName(0x01)); //"EV_KEY"
    console.log('type: ', InputCodes.getType("EV_KEY")); // 18
    console.log('CodeName: ', InputCodes.getCodeName(0x01, 0x01)); "KEY_ESC"
    console.log('CodeName: ', InputCodes.getCode("KEY_ESC")); // 1
    console.log('hasType(3)', evdevjs.HasType(_fd, 3) );
    console.log('hasCode(3, 1)', evdevjs.HasCode(_fd, 3,1) );
  }

function test1() {
  console.log('hello: ', evdevjs.Hello());

  let fd = fs.openSync(path, 'r');
  console.log('jsfd: ', fd);
  let deviceInfo = evdevjs.NewLibevdev(fd);
  console.log('devinfo:', deviceInfo);
  
  let caps = evdevjs.GetCapabilities(fd) ;
  console.log('capabilities:', caps);
  console.log('hasType(3)', evdevjs.HasType(fd, 3) );
  console.log('hasCode(3, 1)', evdevjs.HasCode(fd, 3,1) );
}

test1();

// main();
