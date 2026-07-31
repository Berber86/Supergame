import { encounters as originalEncounters } from './data'
import { newIslandEncounters } from './newEncounters'

export const encounters = [...originalEncounters, ...newIslandEncounters]
