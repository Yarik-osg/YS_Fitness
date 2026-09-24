import { afterEach, describe, expect, it } from 'vitest';
import {
  bindOnboardingDraftToUser,
  resetOnboardingDraft,
  useOnboardingStore,
} from './onboarding-store';

describe('onboarding draft ownership', () => {
  afterEach(() => {
    resetOnboardingDraft();
  });

  it('clears a previous user draft when a new user is bound', () => {
    useOnboardingStore.setState({
      ownerUserId: 'user-a',
      programTrack: 'female',
      biologicalSexForCalculation: 'FEMALE',
      currentBody: 'toned',
      step: 3,
    });

    bindOnboardingDraftToUser('user-b');

    expect(useOnboardingStore.getState()).toMatchObject({
      ownerUserId: 'user-b',
      step: 0,
    });
    expect(useOnboardingStore.getState().programTrack).toBeUndefined();
    expect(useOnboardingStore.getState().currentBody).toBeUndefined();
    expect(useOnboardingStore.getState().physiqueLevel).toBeUndefined();
  });

  it('keeps in-progress answers when the same user is bound again', () => {
    useOnboardingStore.setState({
      ownerUserId: 'user-a',
      programTrack: 'male',
      biologicalSexForCalculation: 'MALE',
      step: 2,
    });

    bindOnboardingDraftToUser('user-a');

    expect(useOnboardingStore.getState()).toMatchObject({
      ownerUserId: 'user-a',
      programTrack: 'male',
      biologicalSexForCalculation: 'MALE',
      step: 2,
    });
  });

  it('lets register claim a guest quiz instead of wiping it', () => {
    useOnboardingStore.setState({
      programTrack: 'female',
      biologicalSexForCalculation: 'FEMALE',
      currentBody: 'toned',
      step: 4,
    });

    bindOnboardingDraftToUser('user-new', { claimGuest: true });

    expect(useOnboardingStore.getState()).toMatchObject({
      ownerUserId: 'user-new',
      programTrack: 'female',
      currentBody: 'toned',
      step: 4,
    });
  });

  it('replaces the current draft when register asks for a fresh quiz', () => {
    useOnboardingStore.setState({
      ownerUserId: 'user-a',
      programTrack: 'female',
      step: 4,
    });

    bindOnboardingDraftToUser('user-a', { replace: true });

    expect(useOnboardingStore.getState()).toMatchObject({
      ownerUserId: 'user-a',
      step: 0,
    });
    expect(useOnboardingStore.getState().programTrack).toBeUndefined();
  });
});
