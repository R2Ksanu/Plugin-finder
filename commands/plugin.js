// plugin.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('plugin')
    .setDescription('Search for a Minecraft plugin across Modrinth, Hangar, and SpigotMC')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Plugin name')
        .setRequired(true)
        // TODO: Add .setAutocomplete(true) when implementing autocomplete
    )
    .addStringOption(option =>
      option.setName('version')
        .setDescription('Minecraft version (e.g. 1.20.1)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const version = interaction.options.getString('version');
    await interaction.deferReply();

    const embeds = [];

    // === MODRINTH ===
    try {
      const modrinthSearch = await axios.get(`https://api.modrinth.com/v2/search?query=${name}`);
      const modProject = modrinthSearch.data.hits[0];
      if (modProject) {
        const versions = await axios.get(`https://api.modrinth.com/v2/project/${modProject.project_id}/version?game_versions=["${version}"]`);
        const match = versions.data[0];
        if (match) {
          embeds.push(new EmbedBuilder()
            .setTitle(modProject.title)
            .setURL(`https://modrinth.com/plugin/${modProject.slug}`)
            .setDescription(modProject.description || 'No description.')
            .setColor(0x1bd96a)
            .addFields(
              { name: 'Platform', value: 'Modrinth', inline: true },
              { name: 'Version', value: version, inline: true },
              { name: 'Download', value: `[Click here](${match.files[0].url})`, inline: true }
            ));
        }
      }
    } catch (err) {
      console.warn('Modrinth error:', err.message);
    }

    // === HANGAR ===
    try {
      const hangarSearch = await axios.get(`https://hangar.papermc.io/api/v1/projects/search?query=${name}`);
      const hangarProject = hangarSearch.data.result[0];
      if (hangarProject) {
        const author = hangarProject.namespace.owner;
        const slug = hangarProject.slug;
        const versions = await axios.get(`https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions`);
        const match = versions.data.find(v => v.minecraftVersions.includes(version));
        if (match) {
          embeds.push(new EmbedBuilder()
            .setTitle(hangarProject.name)
            .setURL(`https://hangar.papermc.io/${author}/${slug}`)
            .setDescription(hangarProject.description || 'No description.')
            .setColor(0xffcc00)
            .addFields(
              { name: 'Platform', value: 'Hangar', inline: true },
              { name: 'Version', value: version, inline: true },
              { name: 'Download', value: `[Click here](https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions/${match.name}/download)`, inline: true }
            ));
        }
      }
    } catch (err) {
      console.warn('Hangar error:', err.message);
    }

    // === SPIGOTMC (Spiget) ===
    try {
      const spigotSearch = await axios.get(`https://api.spiget.org/v2/search/resources/${name}`);
      const result = spigotSearch.data[0];
      if (result) {
        const id = result.id;
        const pluginInfo = await axios.get(`https://api.spiget.org/v2/resources/${id}`);
        embeds.push(new EmbedBuilder()
          .setTitle(pluginInfo.data.name)
          .setURL(`https://www.spigotmc.org/resources/${id}/`)
          .setDescription(pluginInfo.data.tag || 'No description.')
          .setColor(0x00afff)
          .addFields(
            { name: 'Platform', value: 'SpigotMC', inline: true },
            { name: 'Note', value: 'Version not filtered (manual check)', inline: true },
            { name: 'Download', value: `[Click here](https://api.spiget.org/v2/resources/${id}/download)`, inline: true }
          ));
      }
    } catch (err) {
      console.warn('Spiget error:', err.message);
    }

    if (embeds.length === 0) {
      return interaction.editReply(`❌ No plugin found named **${name}** for version ${version}.`);
    }

    await interaction.editReply({ embeds });
  }
};