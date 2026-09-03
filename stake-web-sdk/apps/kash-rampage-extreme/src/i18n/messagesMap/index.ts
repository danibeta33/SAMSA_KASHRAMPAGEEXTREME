import { mergeMessagesMaps } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import ar from './ar';
import de from './de';
import en from './en';
import es from './es';
import fr from './fr';
import id from './id';
import ja from './ja';
import ko from './ko';
import pl from './pl';
import pt from './pt';
import ru from './ru';
import tr from './tr';
import vi from './vi';
import zh from './zh';
import fi from './fi';
import hi from './hi';

// All 16 SDK locales must be registered or Lingui crashes when the iframe
// passes `?lang=de` (and friends). Locales without translated copy fall back
// to English via the per-file `...en` spread.
const messagesMapGame = {
	ar,
	de,
	en,
	es,
	fr,
	id,
	ja,
	ko,
	pl,
	pt,
	ru,
	tr,
	vi,
	zh,
	fi,
	hi,
};

const messagesMap = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml]);

export default messagesMap;
