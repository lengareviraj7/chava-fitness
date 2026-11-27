import { Settings } from '../models/Settings.js';

export const settingsService = {
  async get() {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    return settings;
  },

  async update(data) {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    Object.assign(settings, data);
    await settings.save();
    return settings;
  },
};
