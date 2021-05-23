#!/usr/bin/env node

// 1. read all Device Types and corresponding Codes from libevdev
// 2. for each type
//      create an object <Type> = {code: codeName}
// 3. create EV_TYPES {}
// 4. create InputCodesMap = Map<EV_TYPE_NAME, Array<EV_CODE, EV_CODE_NAME>>



const evdevjs = require('bindings')('evdevjs.node')

// types = [
//   Type = {
//      code: number;
//      name: string;
//      *<code>: <codeName>)*
//    }
//  ]


const LINE = '\n';
const HEADER = 
`
/*
 * InputCodes were enerated by the evdevjs generate-input-codes script.
 */`;

const IMPORTS =  `
const evdevjs = require('bindings')('evdevjs.node');
`;

 const OPEN_NAMESPACE = 
`
export namespace InputCodes {
`;

const NAMESPACE_UTIL_FNS =
`
export const InputCodeMap = _InputCodeMap;
 
export function getTypeName(type: EV_TYPE_CODE): EV_TYPE_NAME {
  return evdevjs.NameForType(type);
}

export function getType(typeName: EV_TYPE_NAME): EV_TYPE_CODE {
  return evdevjs.TypeForName(typeName);
}

export function getCode(codeName: EV_CODE_NAME): EV_CODE {
  return evdevjs.CodeForName(codeName);
}

export function getCodeName(type: EV_TYPE_CODE, code: EV_CODE): EV_CODE_NAME {
  return evdevjs.NameForCode(type, code);
}
`;

const CLOSE_NAMESPACE = `
}
`;

const INPUT_PROP_MAX = 
`
export const INPUT_PROP_MAX = 0x1f;
`;

function generateEvTypeDeclarations(types: any): string {
  
  let type: any = {
        name: "EV_TYPE",
        code: 0,
        codes: []
  }
  
  let codes = type.codes;
  for (const type of types) {
    codes.push(type.code);
    codes.push(type.name);
  }

  return generateTypeDeclarations(type);
}


function generateTypeDeclarations(type: any): string {

  let tscode = 
` 
// *** ${type.name} *** 
`;

  tscode += `export const ${type.name} = {\n`;

  let codes = type.codes;  // Array (code, codeName, code, codeName...)
  for (let i=0; i < codes.length;) {
    tscode += `  ${codes[i++]}: "${codes[i++]}",\n`;
  }

  tscode += 
`} as const;

export type ${type.name}_CODE = keyof typeof ${type.name};
export type ${type.name}_NAME = typeof ${type.name}[${type.name}_CODE];
`;
  return tscode;
}


// export type EV_TYPE = typeof EV_ABSS | typeof EV_KEYS | typeof EV_RELS | typeof EV_SYNS | typeof EV_SYNS | typeof EV_FFS | typeof EMPTY;
// export type EV_CODE_NAME = EV_ABS_NAME | EV_FF_NAME | EV_KEY_NAME | EV_REL_NAME | EV_SW_NAME | EV_SYN_NAME;
// export type EV_CODE = EV_ABS_CODE | EV_FF_CODE | EV_KEY_CODE | EV_REL_CODE | EV_SW_CODE | EV_SYN_CODE;

function generateSuperTypeDeclarations(types: Array<any>): string {
  let tscode = '';

  // export type EV_TYPE = typeof EV_ABSS | typeof EV_KEYS | typeof EV_RELS | .... ;
  let line = "export type EV_TYPE_CLASS = ";
  for (const type of types) {
    line += `typeof ${type.name} | `;
  }
  let idx = line.lastIndexOf(' | ');
  line = line.substring(0, idx) + ';';
  tscode += line;
  tscode += LINE;

  // export type EV_CODE_NAME = EV_ABS_NAME | EV_FF_NAME | EV_KEY_NAME | EV_REL_NAME | EV_SW_NAME | EV_SYN_NAME;
  line = "export type EV_CODE_NAME = ";
  for (const type of types) {
    line += `${type.name}_NAME | `;
  }
  idx = line.lastIndexOf(' | ');
  line = line.substring(0,idx) + ';';
  tscode += line;
  tscode += LINE;

  // export type EV_CODE = EV_ABS_CODE | EV_FF_CODE | EV_KEY_CODE | EV_REL_CODE | EV_SW_CODE | EV_SYN_CODE;
  line = "export type EV_CODE = ";
  for (const type of types) {
    line += `${type.name}_CODE | `;
  }
  idx = line.lastIndexOf(' | ');
  line = line.substring(0,idx) + ';';
  tscode += line;
  tscode += LINE;

  return tscode;
}

function generateMap(types: Array<any>): string {
  // example output
  // export const InputCodeMap = new Map<EV_TYPE_NAME, EV_TYPE>();
  // InputCodeMap.set("EV_ABS", EV_ABS);
  // ...

  let tscode = '';
  tscode += 'const _InputCodeMap = new Map<EV_TYPE_NAME, EV_TYPE_CLASS>();\n';
  for (const type of types) {
    tscode += `_InputCodeMap.set("${type.name}",${type.name});\n`;
  }

  return tscode;
}

function main() {
  const types = evdevjs.GetTypesAndCodes() as Array<any>;
  const inputCodeContent = new Array<string>();

  inputCodeContent.push(HEADER);
  inputCodeContent.push(IMPORTS);
  inputCodeContent.push(OPEN_NAMESPACE);
  inputCodeContent.push(generateEvTypeDeclarations(types));
  for (const type of types) {
    const decl = generateTypeDeclarations(type);
    inputCodeContent.push(decl);
    // inputCodeContent.push(LINE);
  }
  inputCodeContent.push(generateSuperTypeDeclarations(types));
  inputCodeContent.push(generateMap(types));
  
  inputCodeContent.push(INPUT_PROP_MAX);
  inputCodeContent.push(NAMESPACE_UTIL_FNS);
  inputCodeContent.push(CLOSE_NAMESPACE);

  for (const content of inputCodeContent) {
    console.log(content);
  }
}

main();

