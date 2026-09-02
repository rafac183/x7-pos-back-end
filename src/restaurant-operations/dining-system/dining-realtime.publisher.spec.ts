import { DiningRealtimePublisher } from './dining-realtime.publisher';
import { DINING_EVENTS } from './constants/dining-realtime.events';
import type { RealtimeEventBusService } from 'src/realtime/realtime-event-bus.service';

describe('DiningRealtimePublisher', () => {
  const makeBus = () =>
    ({ emitToRoom: jest.fn(), emitToAll: jest.fn() }) as unknown as
      RealtimeEventBusService & { emitToRoom: jest.Mock };

  it('emite a la sala del comercio, no a la de la compañía', () => {
    const bus = makeBus();
    new DiningRealtimePublisher(bus).tableStatusChanged({
      merchantId: 3,
      tableId: 10,
      status: 'occupied',
      parent_table_id: null,
    });

    expect(bus.emitToRoom).toHaveBeenCalledWith(
      'merchant:3',
      DINING_EVENTS.TABLE_STATUS_CHANGED,
      expect.objectContaining({ tableId: 10, status: 'occupied' }),
    );
  });

  it('sella la marca de emisión en el servidor', () => {
    const bus = makeBus();
    new DiningRealtimePublisher(bus).tableTransferred({
      merchantId: 3,
      sourceTableId: 1,
      targetTableId: 2,
      orderId: 9,
    });

    const payload = bus.emitToRoom.mock.calls[0][2] as { emittedAt: string };
    expect(Number.isNaN(Date.parse(payload.emittedAt))).toBe(false);
  });

  it.each([
    ['assignmentChanged', DINING_EVENTS.ASSIGNMENT_CHANGED],
    ['floorPlanUpdated', DINING_EVENTS.FLOOR_PLAN_UPDATED],
  ])('%s viaja con su nombre de evento', (method, event) => {
    const bus = makeBus();
    const publisher = new DiningRealtimePublisher(bus);
    const payload = {
      merchantId: 3,
      assignmentId: 1,
      tableId: 1,
      shiftId: 1,
      collaboratorId: 1,
      action: 'assigned' as const,
      floorPlanId: 1,
    };
    (publisher[method] as (p: typeof payload) => void)(payload);

    expect(bus.emitToRoom).toHaveBeenCalledWith(
      'merchant:3',
      event,
      expect.anything(),
    );
  });

  it('un gateway caído no tumba la operación que ya se persistió', () => {
    const bus = {
      emitToRoom: jest.fn(() => {
        throw new Error('Realtime server is not bound');
      }),
    } as unknown as RealtimeEventBusService;

    expect(() =>
      new DiningRealtimePublisher(bus).tableStatusChanged({
        merchantId: 3,
        tableId: 10,
        status: 'cleaning',
      }),
    ).not.toThrow();
  });
});
