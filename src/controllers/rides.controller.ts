import { Request, Response } from 'express';
import { z } from 'zod';
import { RidesService } from '../services/rides.service';

const createRideSchema = z.object({
  passengerId: z.string().min(1),
  pickup: z.string().min(1),
  drop: z.string().min(1),
});

export async function createRide(req: Request, res: Response) {
  try {
    const { passengerId, pickup, drop } = createRideSchema.parse(req.body);
    const ride = await RidesService.createRide(passengerId, pickup, drop);
    return res.status(201).json(ride);
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'Invalid request' });
  }
}

export async function getRideHistory(req: Request, res: Response) {
  try {
    const passengerId = z.string().min(1).parse(req.params.passengerId);
    const rides = await RidesService.getPassengerHistory(passengerId);
    return res.json({ rides });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'Invalid request' });
  }
}

export async function getRideDetails(req: Request, res: Response) {
  try {
    const rideId = z.string().min(1).parse(req.params.rideId);
    const ride = await RidesService.getRideWithDriver(rideId);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    return res.json({ ride });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'Invalid request' });
  }
}

const nearbyDriversSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  radius: z.number().optional().default(10),
});

export async function getNearbyDrivers(req: Request, res: Response) {
  try {
    const { lat, lng, radius } = nearbyDriversSchema.parse(req.query);
    const drivers = await RidesService.getNearbyDrivers(lat, lng, radius);
    return res.json({ drivers, count: drivers.length });
  } catch (e: any) {
    return res.status(400).json({ error: e.message || 'Invalid request' });
  }
}