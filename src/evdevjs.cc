#include <iostream>
#include <map>
#include <string>

#include "napi.h"

extern "C" {
#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <linux/input.h>
#include <libevdev/libevdev.h>
#include <libevdev/libevdev-uinput.h>
}

using namespace Napi;
using namespace std;


static std::map<int, libevdev*> LIBEVDEV_MAP;
static std::map<int, libevdev_uinput*> UINPUT_MAP;


Object createDeviceInfo(Env env, libevdev *evdev) {
  Object deviceInfo = Object::New(env);
  
  deviceInfo.Set("name", String::New(env, libevdev_get_name(evdev)));
  deviceInfo.Set("bustype", Number::New(env, libevdev_get_id_bustype(evdev)));
  deviceInfo.Set("vendor", Number::New(env, libevdev_get_id_vendor(evdev)));
  deviceInfo.Set("product", Number::New(env, libevdev_get_id_product(evdev)));
  deviceInfo.Set("version", Number::New(env, libevdev_get_id_version(evdev)));

  const char* phys = libevdev_get_phys(evdev);
  deviceInfo.Set("phys", String::New(env, phys == NULL ? "" : phys));

  const char* uniq = libevdev_get_uniq(evdev);
  deviceInfo.Set("uniq", String::New(env, uniq == NULL ? "" : uniq));

  return deviceInfo;
}

Value NewLibevdev(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  int devid = info[0].As<Number>().Uint32Value();
  LIBEVDEV_MAP.insert(std::pair<int,libevdev*>(devid, libevdev_new()));

  return Boolean::New(env,true);
}

Value ReleaseLibevdev(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev* evdev = LIBEVDEV_MAP.at(devid);
  LIBEVDEV_MAP.erase(devid);
  libevdev_free(evdev);

  return env.Undefined();
}

Value SetFD(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev* evdev = LIBEVDEV_MAP.at(devid);
  const int fd = info[1].As<Number>().Int32Value();
  
  bool result = libevdev_set_fd(evdev, fd) == 0 ? true : false;

  return Boolean::New(env, result);
}

Value GetDeviceInfo(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  int devid = info[0].As<Number>().Uint32Value();
  struct libevdev *evdev = LIBEVDEV_MAP.at(devid);

  return createDeviceInfo(env, evdev);
}

Value Grab(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsBoolean()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  const bool enabled = info[1].As<Boolean>().Value();
  struct libevdev* evdev = LIBEVDEV_MAP.at(devid);

  bool result = libevdev_grab(evdev, enabled ? LIBEVDEV_GRAB : LIBEVDEV_UNGRAB) == 0 ? true : false;

  return Boolean::New(env, result);
}

Value GetCapabilities(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  const struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  Array capabilities = Array::New(env);

  for (uint32_t typeCode=1; typeCode < EV_MAX; typeCode++) {
    if (!libevdev_has_event_type(evdev, typeCode)) continue;
    if (strcmp("EV_SYN", libevdev_event_type_get_name(typeCode)) == 0) continue;
    //cout << "type: " << libevdev_event_type_get_name(typeCode) << "\n";

    uint32_t max_codes = libevdev_event_type_get_max(typeCode);
    if (max_codes < 1) continue;

    Object capability = Object::New(env);
    capability.Set("code", (double)typeCode);
    Array events = Array::New(env);
    capability.Set("events",events);

    for (uint32_t code=0; code < max_codes; code++) {
      if (!libevdev_has_event_code(evdev, typeCode, code)) continue;

      Object eventDescriptor = Object::New(env);
      eventDescriptor.Set("code", (double)code);

      const struct input_absinfo* absinfo = libevdev_get_abs_info(evdev,code);
      if (absinfo != nullptr) {
          // cout << "found: " << typeCode << "," << libevdev_event_code_get_name(typeCode,code) << " has-absinfo\n";
          // code
          // min     -32768
          // max      32767
          // fuzz        16
          // flat       128
          // resolution   0
          Object absinfoJs = Object::New(env);
          absinfoJs.Set("min", (double)absinfo->minimum);
          absinfoJs.Set("max", (double)absinfo->maximum);
          absinfoJs.Set("fuzz", (double)absinfo->fuzz);
          absinfoJs.Set("flat", (double)absinfo->flat);
          absinfoJs.Set("resolution", (double)absinfo->resolution);

          eventDescriptor.Set("absInfo", absinfoJs);
      }

      events.Set(events.Length(), eventDescriptor);
    }

     capabilities.Set(capabilities.Length(), capability);
  }

  return capabilities;
}

Value HasProperty(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  const struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t propCode = info[1].As<Number>().Uint32Value() == 1 ? true : false;

  bool result = libevdev_has_property(evdev, propCode) == 1 ? true : false;

  return Boolean::New(env, result);
}

Value HasType(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  const struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t typeCode = info[1].As<Number>().Uint32Value();

  bool result = libevdev_has_event_type(evdev, typeCode) == 1 ? true : false;
    
  return Boolean::New(env, result);
}

Value HasCode(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 3) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  const struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t typeCode = info[1].As<Number>().Uint32Value();
  const uint32_t code = info[2].As<Number>().Uint32Value();

  bool result = libevdev_has_event_code(evdev, typeCode, code) == 1 ? true : false;

  return Boolean::New(env, result);
}

Value EnableEventType(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 3) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsBoolean()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t typeCode = info[1].As<Number>().Uint32Value();
  const bool enabled = info[2].As<Boolean>().Value();

  bool result = 
    enabled ? 
      libevdev_enable_event_type(evdev, typeCode) == 0:
      libevdev_disable_event_type(evdev, typeCode) == -1;

  return Boolean::New(env, result);
}

Value EnableEventCode(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 4) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber() || !info[3].IsBoolean()) { 
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t typeCode = info[1].As<Number>().Uint32Value();
  const uint32_t code = info[2].As<Number>().Uint32Value();
  const bool enabled = info[3].As<Boolean>().Value();

  bool result;

  if (enabled) {

    int refinfo;
    struct input_absinfo absinfo;
    void* data = nullptr;

    if (typeCode == EV_ABS) {
      data = &absinfo;
    } else if (typeCode == EV_REL) {
      data = &refinfo;
    }

    result = libevdev_enable_event_code(evdev, typeCode, code, data) == 0 ? true : false;
  } else {
    result = libevdev_disable_event_code(evdev, typeCode, code) == 0 ? true : false;
  }

  return Boolean::New(env, result);
}

Value EnableProperty(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 3) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsBoolean()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev *evdev = LIBEVDEV_MAP.at(devid);
  const uint32_t propertyCode = info[1].As<Number>().Uint32Value();
  const bool enabled = info[2].As<Boolean>().Value();

  bool result = 
    enabled ? 
      libevdev_enable_property(evdev, propertyCode) == 0 :
      libevdev_disable_property(evdev, propertyCode) == -1;

  return Boolean::New(env, result);
}

Value NextEvent(const CallbackInfo& info) {
  const Env env = info.Env();

  if (info.Length() < 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devId = info[0].As<Number>().Uint32Value();
  struct libevdev *evdev = LIBEVDEV_MAP.at(devId);
  struct input_event evdevEvent;

  int result = libevdev_next_event(evdev, LIBEVDEV_READ_FLAG_NORMAL, &evdevEvent);

  if (result == LIBEVDEV_READ_STATUS_SYNC) {
    // If a device needs to be synced by the caller but the caller does not call
    // with the LIBEVDEV_READ_STATUS_SYNC flag set, all events from the diff are
    // dropped and event processing continues as normal.
    result = libevdev_next_event(evdev, LIBEVDEV_READ_FLAG_NORMAL, &evdevEvent);
  }

  if (result == -EAGAIN) {
    // no event read
    return env.Null();
  }

  // input_event
  //    time: time {tv_sec, tv_usec}
  //    __u16 type
  //    __u16 code
  //    __u32 value
  Object event = Object::New(env);
  Object time = Object::New(env);
  time.Set("tv_sec", Number::New(env, (double)evdevEvent.time.tv_sec));
  time.Set("tv_usec", Number::New(env, (double)evdevEvent.time.tv_usec));
  event.Set("time", time);
  event.Set("type", Number::New(env, (double)evdevEvent.type));
  event.Set("code", Number::New(env, (double)evdevEvent.code));
  event.Set("value", Number::New(env, (double)evdevEvent.value));

  return event;
}

Value TypeForName(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  int type = libevdev_event_type_from_name(info[0].As<String>().Utf8Value().c_str());

  return Number::New(env, (double)type);
}

Value NameForType(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const char* name = libevdev_event_type_get_name((unsigned int)info[0].As<Number>().Uint32Value() );

  return String::New(env, name);
}

Value CodeForName(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  int code = libevdev_event_code_from_code_name(info[0].As<String>().Utf8Value().c_str());

  return Number::New(env, (double)code);
}

Value NameForCode(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const char* name = libevdev_event_code_get_name(
                      (unsigned int)info[0].As<Number>().Uint32Value(),
                      (unsigned int)info[1].As<Number>().Uint32Value());

  return String::New(env, name);
}

Array GetTypesAndCodes(const CallbackInfo& info) {
  const Env env = info.Env();
  Array types = Array::New(env);

  for (uint32_t typeCode=0; typeCode < EV_MAX; typeCode++) {
    int max_codes = libevdev_event_type_get_max(typeCode);
    if (max_codes < 1) continue;

    Object type = Object::New(env);
    type.Set("code", (double)typeCode);
    type.Set("name", libevdev_event_type_get_name(typeCode));
  
    Array codes = Array::New(env);

    for (uint32_t code=0; code < (uint32_t)max_codes; code++) {
      const char* codeName = libevdev_event_code_get_name(typeCode, code);
      if (codeName != nullptr) {
        codes.Set(codes.Length(), code);
        codes.Set(codes.Length(), codeName);
      }
    }

    type.Set("codes", codes);
    types.Set(types.Length(), type);
  }

  return types;
}

Value CreateUInputFromDevice(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int devid = info[0].As<Number>().Uint32Value();
  struct libevdev* evdev = LIBEVDEV_MAP.at(devid);

  const int uinputid = info[1].As<Number>().Uint32Value();
  struct libevdev_uinput* uinput;
  int result = 
    libevdev_uinput_create_from_device(evdev, LIBEVDEV_UINPUT_OPEN_MANAGED, &uinput);

  if (result < 0) return env.Null();

  UINPUT_MAP.insert(std::pair<int,libevdev_uinput*>(uinputid, uinput));

  int uinput_fd = libevdev_uinput_get_fd(uinput);
  return Number::New(env, uinput_fd);
}

Value ReleaseUInput(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int uinputid = info[0].As<Number>().Uint32Value();
  struct libevdev_uinput* uinput = UINPUT_MAP.at(uinputid);
  UINPUT_MAP.erase(uinputid);
  libevdev_uinput_destroy(uinput);

  return env.Undefined();
}

Value GetDevNodeForUInput(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 1) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber()) {
    TypeError::New(env, "Wrong argument type").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int uinputid = info[0].As<Number>().Uint32Value();
  struct libevdev_uinput* uinput = UINPUT_MAP.at(uinputid);
  const char *devNode = libevdev_uinput_get_devnode(uinput);

  return devNode != nullptr ? String::New(env, devNode) : env.Null();
}

Value UInputWriteEvent(const CallbackInfo& info) {
  Env env = info.Env();

  if (info.Length() != 2) {
    TypeError::New(env, "Wrong number of arguments")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsNumber() || !info[1].IsObject()) {
    TypeError::New(env, "Wrong argument types").ThrowAsJavaScriptException();
    return env.Null();
  }

  const int uinputid = info[0].As<Number>().Uint32Value();
  struct libevdev_uinput* uinput = UINPUT_MAP.at(uinputid);
  const Object event = info[1].As<Object>();
  const uint32_t typeCode = event.Get("type").As<Number>().Uint32Value();
  const uint32_t code = event.Get("code").As<Number>().Uint32Value();
  const uint32_t value = event.Get("value").As<Number>().Int32Value();

  bool result = libevdev_uinput_write_event(uinput, typeCode, code, value) < 0 ? false : true;

  return Boolean::New(env, result);
}

String Hello(const CallbackInfo& info) {
  Env env = info.Env();
  return String::New(env, "hello world");
}

Object Init(Env env, Object exports) {
  exports.Set(String::New(env, "NewLibevdev"), Function::New(env, NewLibevdev));
  exports.Set(String::New(env, "ReleaseLibevdev"), Function::New(env, ReleaseLibevdev));
  exports.Set(String::New(env, "SetFD"), Function::New(env, SetFD));
  exports.Set(String::New(env, "GetDeviceInfo"), Function::New(env, GetDeviceInfo));
  exports.Set(String::New(env, "Grab"), Function::New(env, Grab));
  exports.Set(String::New(env, "GetCapabilities"), Function::New(env, GetCapabilities));
  exports.Set(String::New(env, "HasType"), Function::New(env, HasType));
  exports.Set(String::New(env, "HasCode"), Function::New(env, HasCode));
  exports.Set(String::New(env, "EnableEventType"), Function::New(env, EnableEventType));
  exports.Set(String::New(env, "EnableEventCode"), Function::New(env, EnableEventCode));
  exports.Set(String::New(env, "EnableProperty"), Function::New(env, EnableProperty));
  exports.Set(String::New(env, "NextEvent"), Function::New(env, NextEvent));
  exports.Set(String::New(env, "TypeForName"), Function::New(env, TypeForName));
  exports.Set(String::New(env, "NameForType"), Function::New(env, NameForType));
  exports.Set(String::New(env, "CodeForName"), Function::New(env, CodeForName));
  exports.Set(String::New(env, "NameForCode"), Function::New(env, NameForCode));
  exports.Set(String::New(env, "GetTypesAndCodes"), Function::New(env, GetTypesAndCodes));
  exports.Set(String::New(env, "CreateUInputFromDevice"), Function::New(env, CreateUInputFromDevice));
  exports.Set(String::New(env, "ReleaseUInput"), Function::New(env, ReleaseUInput));
  exports.Set(String::New(env, "GetDevNodeForUInput"), Function::New(env, GetDevNodeForUInput));
  exports.Set(String::New(env, "UInputWriteEvent"), Function::New(env, UInputWriteEvent));

  exports.Set(String::New(env, "Hello"), Function::New(env, Hello));
  return exports;
}

NODE_API_MODULE(evdevjs, Init)
