// Canonical enumerations so UI + personalization share the same keys.
export const TRAITS = {
  size: ['xs','s','m','l','xl'],
  sex: ['male','female','unknown'],
  spayNeuter: ['spayed','neutered','intact','unknown'],

  chewStrength: ['soft','moderate','power'],

  diets: [
    'grain-free','limited-ingredient','wet','dry',
    'raw','freeze-dried','high-protein'
  ],

  toyTypes: [
    'plush','rope','rubber','squeaker','fetch','tug','puzzle','ball','feather','laser'
  ],

  flavors: [
    'chicken','beef','salmon','tuna','turkey','lamb',
    'peanut-butter','cheese','pumpkin','sweet-potato'
  ],

  catnip: ['likes','dislikes','unknown'],

  sensitivities: [
    'sensitive-stomach','skin-allergies','anxious',
    'joint-issues','dental'
  ],

  commonAllergies: [
    'chicken','beef','dairy','grain','soy','fish','egg','lamb',
    'turkey','pork','corn','pea','rice'
  ]
};

// A clean default traits object
export function defaultTraits() {
  return {
    size: '',
    weightLb: '',
    sex: 'unknown',
    spayNeuter: 'unknown',
    chewStrength: '',
    diets: [],
    toyTypes: [],
    flavors: [],
    catnip: 'unknown',
    sensitivities: [],
    allergies: [],
    neckIn: '',
    chestIn: '',
    backIn: '',
    notes: ''
  };
}