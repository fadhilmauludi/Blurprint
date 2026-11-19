/** Local stand-in for `@devvit/analytics/client/reddit`: logs events to the console. */
const log =
  (name: string) =>
  async (input?: unknown): Promise<{ receipt: { status: string } }> => {
    console.info(`[telemetry] ${name}`, input ?? '');
    (window as unknown as { __telemetry?: unknown[] }).__telemetry ??= [];
    (window as unknown as { __telemetry: unknown[] }).__telemetry.push({ name, input });
    return { receipt: { status: 'HARNESS' } };
  };

export const telemetry = {
  appReady: log('App.Ready'),
  startJourney: log('Journey.Start'),
  progress: log('Journey.Progress'),
  interaction: log('Journey.Interaction'),
  endJourney: log('Journey.End'),
  getActiveJourneyId: () => undefined,
  setJourneyId: () => undefined,
  clearJourneyId: () => undefined,
};
