/** Africa's Talking SDK ships without types — minimal surface declaration. */
declare module "africastalking" {
  interface AtSmsService {
    send(
      opts: { to: string[]; message: string; from?: string },
      cb: (err: unknown, result?: unknown) => void,
    ): void;
  }
  interface AtInstance {
    SMS: AtSmsService;
  }
  const africastalking: {
    initialize(opts: { username: string; apiKey: string }): AtInstance;
  };
  export default africastalking;
}
