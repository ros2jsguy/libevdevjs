{
  "targets": [
    {
      "target_name": "evdevjs",
      "sources": [ "src/evdevjs.cc" ],
      'cflags': [
        '<!@(pkg-config --cflags libevdev)'
      ],
      'include_dirs': [
        '.',
        "<!(node -p \"require('node-addon-api').include_dir\")",
        '/usr/include/libevdev-1.0/libevdev'
      ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'ldflags': [
        '<!@(pkg-config --libs-only-L --libs-only-other libevdev)'
      ],
      'libraries': [
        '<!@(pkg-config --libs-only-l libevdev)'
      ],
    }
  ]
}
