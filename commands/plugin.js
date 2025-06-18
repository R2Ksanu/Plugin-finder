import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';

export default {
  data: new SlashCommandBuilder()
    .setName('plugin')
    .setDescription('Search for a Minecraft plugin across Modrinth, Hangar, and SpigotMC')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Plugin name')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option
        .setName('software')
        .setDescription('Server software')
        .setRequired(true)
        .addChoices(
          { name: 'Paper', value: 'paper' },
          { name: 'Spigot', value: 'spigot' },
          { name: 'BungeeCord', value: 'bungeecord' },
          { name: 'Waterfall', value: 'waterfall' }
        )
    )
    .addStringOption(option =>
      option
        .setName('version')
        .setDescription('Minecraft version (e.g., 1.20.1)')
        .setRequired(true)
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const plugins = [];

    try {
      // Modrinth search
      const modrinthSearch = await axios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(focusedValue)}`);
      modrinthSearch.data.hits.slice(0, 5).forEach(project => {
        plugins.push({ name: project.title, value: project.title });
      });

      // Hangar search
      const hangarSearch = await axios.get(`https://hangar.papermc.io/api/v1/projects/search?query=${encodeURIComponent(focusedValue)}`);
      hangarSearch.data.result.slice(0, 5).forEach(project => {
        plugins.push({ name: project.name, value: project.name });
      });

      // SpigotMC search (Spiget)
      const spigotSearch = await axios.get(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(focusedValue)}`);
      spigotSearch.data.slice(0, 5).forEach(resource => {
        plugins.push({ name: resource.name, value: resource.name });
      });
    } catch (error) {
      console.warn('Autocomplete search error:', error.message);
    }

    // Limit to 25 choices (Discord's max)
    const uniquePlugins = [...new Map(plugins.map(item => [item.value, item])).values()].slice(0, 25);
    await interaction.respond(uniquePlugins);
  },

  async execute(interaction) {
    const name = interaction.options.getString('name');
    const software = interaction.options.getString('software');
    const version = interaction.options.getString('version');
    await interaction.deferReply();

    const embeds = [];

    // Modrinth
    try {
      const modrinthSearch = await axios.get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(name)}`);
      const modProject = modrinthSearch.data.hits.find(p => p.title.toLowerCase() === name.toLowerCase());
      if (modProject) {
        const versions = await axios.get(
          `https://api.modrinth.com/v2/project/${modProject.project_id}/version?loaders=["${software}"]&game_versions=["${version}"]`
        );
        const match = versions.data[0];
        if (match) {
          embeds.push(
            new EmbedBuilder()
              .setTitle(modProject.title)
              .setURL(`https://modrinth.com/plugin/${modProject.slug}`)
              .setDescription(modProject.description || 'No description.')
              .setColor(0x1bd96a)
              .addFields(
                { name: 'Platform', value: 'Modrinth', inline: true },
                { name: 'Software', value: software, inline: true },
                { name: 'Version', value: version, inline: true },
                { name: 'Download', value: `[Click here](${match.files[0].url})`, inline: true }
              )
          );
        }
      }
    } catch (err) {
      console.warn('Modrinth error:', err.message);
    }

    // Hangar
    try {
      const hangarSearch = await axios.get(`https://hangar.papermc.io/api/v1/projects/search?query=${encodeURIComponent(name)}`);
      const hangarProject = hangarSearch.data.result.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (hangarProject) {
        const author = hangarProject.namespace.owner;
        const slug = hangarProject.slug;
        const versions = await axios.get(`https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions`);
        const match = versions.data.find(v => v.minecraftVersions.includes(version) && v.platforms.includes(software.toUpperCase()));
        if (match) {
          embeds.push(
            new EmbedBuilder()
              .setTitle(hangarProject.name)
              .setURL(`https://hangar.papermc.io/${author}/${slug}`)
              .setDescription(hangarProject.description || 'No description.')
              .setColor(0xffcc00)
              .addFields(
                { name: 'Platform', value: 'Hangar', inline: true },
                { name: 'Software', value: software, inline: true },
                { name: 'Version', value: version, inline: true },
                { name: 'Download', value: `[Click here](https://hangar.papermc.io/api/v1/projects/${author}/${slug}/versions/${match.name}/download)`, inline: true }
              )
          );
        }
      }
    } catch (err) {
      console.warn('Hangar error:', err.message);
    }

    // SpigotMC (Spiget)
    try {
      const spigotSearch = await axios.get(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(name)}`);
      const result = spigotSearch.data.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (result) {
        const id = result.id;
        const pluginInfo = await axios.get(`https://api.spiget.org/v2/resources/${id}`);
        // Spiget doesn't support version/software filtering reliably, so note manual check
        embeds.push(
          new EmbedBuilder()
            .setTitle(pluginInfo.data.name)
            .setURL(`https://www.spigotmc.org/resources/${id}/`)
            .setDescription(pluginInfo.data.tag || 'No description.')
            .setColor(0x00afff)
            .addFields(
              { name: 'Platform', value: 'SpigotMC', inline: true },
              { name: 'Software', value: software, inline: true },
              { name: 'Version', value: 'Manual check required', inline: true },
              { name: 'Download', value: `[Click here](https://api.spiget.org/v2/resources/${id}/download)`, inline: true }
            )
        );
      }
    } catch (err) {
      console.warn('Spiget error:', err.message);
    }

    if (embeds.length === 0) {
      return interaction.editReply(`❌ No plugin found named **${name}** for ${software} on version ${version}.`);
    }

    await interaction.editReply({ embeds });
  }
};