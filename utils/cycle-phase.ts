export enum CyclePhase {
    MENSTRUAL = 'menstrual',
    FOLLICULAR = 'follicular',
    OVULATION = 'ovulation',
    LUTEAL = 'luteal',
}

export const cyclePhaseAdditionalCalories = {
    [CyclePhase.MENSTRUAL]: 0,
    [CyclePhase.FOLLICULAR]: 100,
    [CyclePhase.OVULATION]: 200,
    [CyclePhase.LUTEAL]: 300,
}


export const cyclePhaseToIndex = (phase: CyclePhase) => {
    return Object.values(CyclePhase).indexOf(phase);
}