
import {InputCodes} from "./input-codes";

// export type Event = {
//   time:  {tv_sec: number, tv_usec: number};
//   type: EV_TYPE_CODE;
//   code: EV_CODE; // eventType.eventCode
//   value: number;
// };

export type EventTimestamp = {
  tv_sec: number;
  tv_usec: number;
}

export interface Event {
  readonly time?: EventTimestamp;
  readonly type: InputCodes.EV_TYPE_CODE;
  readonly code: InputCodes.EV_CODE;
  readonly value: number;
}

export namespace Event {

  export function createEvent(type: InputCodes.EV_TYPE_CODE | InputCodes.EV_TYPE_NAME, code: InputCodes.EV_CODE | InputCodes.EV_CODE_NAME, value: number): Event {
    let typeCode = type;
    if (typeof type === 'string') {
      typeCode = InputCodes.getType(type);
    }
   
    let codeNum = typeof code === 'string' ?
          InputCodes.getCode(code as InputCodes.EV_CODE_NAME) as InputCodes.EV_CODE : code;
  
    return {
      type: typeCode as InputCodes.EV_TYPE_CODE,
      code: codeNum,
      value: value
    }
  }

  export function toString(event: Event): string {
    return `Event{type: ${event.type} (${InputCodes.getTypeName(event.type)}), code: ${event.code} (${InputCodes.getCodeName(event.type, event.code)}), value: ${event.value}, time: {${event.time ? `${event.time.tv_sec},${event.time.tv_usec}` : ''}}}`;
  }

}