import { randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import sequelize from './config/database';
import { isConfiguredOwner, ownerAccountId, ownerEmail, ownerRole } from './config/platform';
import { User } from './models/User';

async function provision() {
  const email = ownerEmail();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    throw new Error('Configure the confirmed PLATFORM_OWNER_EMAIL before provisioning.');
  }
  const internalEmail = ownerAccountId(email);
  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(2114826002)', { transaction });
    const existing = await User.findAll({
      where: { [Op.or]: [{ email: internalEmail }, { role: ownerRole }] },
      transaction
    });
    if (existing.length) {
      if (existing.length !== 1 || !isConfiguredOwner(existing[0])) {
        throw new Error('A different platform owner identity already exists.');
      }
      console.log('Platform owner already provisioned.');
      return;
    }
    await User.create({
      role: ownerRole, cooperativeId: null, email: internalEmail,
      password: randomBytes(32).toString('base64url'), firstName: 'Platform', lastName: 'Owner',
      phone: '', isEmailVerified: false, twoFAEnabled: true, twoFAMethod: 'email'
    }, { transaction });
    console.log('Platform owner provisioned. Use the password reset page to activate.');
  });
}

provision().catch((error: Error) => {
  console.error(error.name === 'Error' ? error.message : 'Platform owner provisioning failed.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
