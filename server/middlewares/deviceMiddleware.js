export async function deviceMiddleware(req, res, next) {
  const apiKey = req.query.deviceKey;

  if (!apiKey) return res.status(401).json({ error: "No device key" });

  const device = await masterPrisma.device.findUnique({
    where: { apiKey, isActive: true },
  });

  if (!device) return res.status(401).json({ error: "Unknown device" });

  req.device = device;
  req.tenantId = device.tenantId;
  req.prisma = getPrismaClient(device.tenantId);

  next();
}
