// Shared by both Pokemon-creation flows, mirroring pickRandomNatureId. Uniform 50/50 male/female --
// doesn't account for per-species gender ratios or genderless species (e.g. Magnemite), since no
// species-level gender data exists anywhere in this schema. 'genderless' stays available as an
// explicit manual choice for whoever knows a given species should have one, just never rolled.
export function pickRandomGender(): 'male' | 'female' {
  return Math.random() < 0.5 ? 'male' : 'female'
}
