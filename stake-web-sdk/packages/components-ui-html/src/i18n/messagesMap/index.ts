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

// All 16 SDK locales registered so Lingui can switch to any of them; locales
// without translated copy fall back to English via the per-file `...en` spread.
const messagesMap = {
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

export default messagesMap;
