import { Plugin, moment, TFile } from 'obsidian';

export default class Startup extends Plugin {
	// eslint-disable-next-line
	private tp = null as any;

	private dailyFolder = '_Daily/';
	private templatePath = '_Templates/Daily.md';
	private template = '';

	private isNote = /^\d{4}-\d{2}-\d{2}/;
	private isDaily = /^\d{4}-\d{2}-\d{2}$/;

	async onload() {
		this.setMomentLocale();

		// this.AIcreateDaily('2024-12-20');

		this.app.workspace.onLayoutReady(async () => {
			await this.setTemplater();
			await this.getTemplate();
			await this.checkAllForMissingDailys();
			this.registerEvent(
				this.app.vault.on('create', this.checkForMissingDaily.bind(this))
			);
		});
	}

	private setMomentLocale() {
		console.log('STARTUP: Set moment locale to "de"');
		moment.locale('de');
	}

	private async setTemplater() {
		// @ts-ignore: app.plugins exist
		const templater = await this.app.plugins.getPlugin('templater-obsidian')
			.templater;
		this.tp = templater.current_functions_object;
	}

	private async getTemplate() {
		const file = this.app.vault.getFileByPath(this.templatePath) as TFile;
		const content = await this.app.vault.cachedRead(file);
		this.template = content.replace('<% tp.file.cursor() %>\n', '');
	}

	private async checkForMissingDaily(file: TFile) {
		if (!file) return;
		if (!file.path.startsWith(this.dailyFolder)) return;

		// @ts-ignore basename exists
		const filename = file.basename;
		if (!this.isNote.test(filename)) return;
		if (this.isDaily.test(filename)) return;

		const date = filename.slice(0, 10);
		const daily = this.getDailyPath(date) + date + '.md';
		if (await this.tp.file.exists(daily)) return;
		console.log('STARTUP');
		console.log('    Note without corresponding daily created: ', filename);
		setTimeout(async () => await this.createDaily(date), 500);
	}

	private async checkAllForMissingDailys() {
		console.log('STARTUP: Check for missing daily notes');
		const all: TFile[] = this.app.vault.getMarkdownFiles();
		const path = all.filter((file) => file.path.startsWith(this.dailyFolder));
		const files = path.filter((file) => this.isNote.test(file.basename));
		const [dailys, notes] = partition(
			files,
			(f: TFile) => f.basename.length === 10
		);
		const dailyNames = dailys.map((daily: TFile) => daily.basename);

		notes.forEach((note: TFile) => {
			const correspondingDaily = note.basename.slice(0, 10);
			if (dailyNames.includes(correspondingDaily)) return;

			console.log('    Note without corresponding daily: ', note.basename);
			this.createDaily(correspondingDaily);
			dailyNames.push(correspondingDaily);
		});
	}

	private async createDaily(date: string) {
		const filename = date;
		const path = this.getDailyPath(date);
		console.log('    Create: ', path + filename);
		await this.tp.file.create_new(this.template, filename, false, path);
	}

	private getDailyPath(date: string) {
		return this.dailyFolder + moment(date).format('YYYY/MM MMMM/');
	}

	/* private async AIcreateDaily(date: string) {
		try {
			const quickAddPlugin = this.app.plugins.plugins.quickadd;
			if (!quickAddPlugin) throw new Error('QuickAdd plugin not found');

			const choiceName = 'Daily'; // Replace with your macro name
			const choice = quickAddPlugin.settings.choices.find(
				(choice: any) => choice.name === choiceName
			);
			if (!choice) throw new Error(`Choice "${choiceName}" not found`);

			// Store the original variable configuration
			const originalPath = choice.fileNameFormat.format;
			const newPath = `_Daily/${moment(date).format(
				'YYYY/MM MMMM/YYYY-MM-DD'
			)}`;
			console.log(choice);

			choice.fileNameFormat.format = newPath;
			console.log(choice.fileNameFormat.format);

			// Execute the macro with our temporary configuration
			await quickAddPlugin.api.executeChoice(choice.name);

			// Restore the original configuration
			choice.fileNameFormat.format = originalPath;
			console.log(choice.fileNameFormat.format);

			console.log(`Daily note created for ${date.format('YYYY-MM-DD')}`);
		} catch (error) {
			console.error('Failed to create daily note:', error);
		}
	} */
}

function partition<T>(array: Array<T>, isValid: (e: T) => boolean) {
	return array.reduce(
		([pass, fail], elem) => {
			return isValid(elem)
				? [[...pass, elem], fail]
				: [pass, [...fail, elem]];
		},
		[[], []]
	);
}
