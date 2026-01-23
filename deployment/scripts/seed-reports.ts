import { sleep } from "../../src/core/shared-utils";
import { createReport } from "../../src/db/utils/reports";

const reportsToCreate = 40;

const lorem = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque vulputate elit tortor, eget porttitor lorem pretium non. Praesent et nunc porta, elementum odio a, faucibus ante. Integer non ante orci. Nunc ac turpis sit amet mi dignissim finibus ut ut metus. Aliquam eu eros aliquam, euismod massa a, iaculis urna. Etiam tristique tellus quam, in venenatis sapien tempus fermentum. Vivamus pulvinar lorem consequat sapien aliquam sollicitudin sed nec metus. Aenean eget nulla vel risus bibendum interdum. Aenean a nunc arcu. Nulla id gravida erat. Suspendisse porttitor, diam ut tristique mattis, odio ipsum vulputate tellus, nec rutrum ligula lorem quis tellus.

Vivamus nec iaculis nibh. Ut consequat, leo sit amet semper vulputate, tortor sapien finibus dui, eu faucibus erat eros efficitur lectus. Ut sed accumsan magna, sit amet viverra ante. Sed elementum leo eget est fermentum, at convallis sapien volutpat. Etiam sed suscipit metus. Morbi ac sem nec velit sagittis accumsan. Quisque efficitur lectus ac massa porta facilisis. Donec ut dui consectetur, egestas felis non, pharetra dui. Sed consectetur lacus a tortor pellentesque, quis interdum eros placerat. Aliquam commodo, erat vitae faucibus eleifend, tellus augue ornare sapien, eget posuere velit metus eu turpis. Etiam aliquet consequat ipsum, auctor dictum magna porttitor in.

Ut aliquam laoreet lorem. Cras diam mi, mollis eget sem id, mollis ornare orci. Nunc ornare semper tempus. Aenean tincidunt, nisi a rhoncus tempor, quam tortor tristique lacus, eu aliquet diam ex a arcu. In mollis eu diam sit amet tincidunt. Sed dapibus lacinia enim a ultricies. Cras finibus id dolor a vehicula. Proin sed nisi elit. Aliquam porttitor nisl eu facilisis consequat. Integer quis faucibus nisi. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Aenean facilisis porttitor nunc, id rhoncus mauris egestas id. Integer in nisi lacinia, ultrices ante dignissim, rhoncus turpis. Integer eleifend metus nunc, et aliquam est vehicula non.

Nam cursus mauris nisl, in dictum lacus congue in. Cras lacus est, sollicitudin a interdum sed, dictum a neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec pellentesque ipsum mauris, et pulvinar metus mollis ut. Nam quam neque, pulvinar sit amet lacinia sed, facilisis id erat. In a turpis sem. Ut sit amet enim finibus, malesuada est vitae, vehicula ex. Suspendisse efficitur accumsan consequat.

Nunc viverra velit eget erat sagittis, eu euismod dolor molestie. Donec eleifend nunc ut ex malesuada, lacinia efficitur justo porttitor. In viverra ante vel semper efficitur. Phasellus vehicula viverra enim, id euismod felis bibendum ac. Vivamus lacinia, tellus ac dignissim fermentum, mauris mauris pharetra quam, vitae faucibus augue arcu ut nunc. Suspendisse tincidunt elit non ipsum semper, vehicula eleifend orci venenatis. Sed tempor volutpat elit, sed molestie mauris eleifend non. In hac habitasse platea dictumst. Vivamus ultricies nisi nec fermentum pharetra. Donec in enim volutpat eros pretium imperdiet vel et risus. Ut rutrum sapien fermentum ante sagittis fermentum. Curabitur rhoncus vestibulum accumsan. Donec lobortis cursus tortor eget sollicitudin. Aliquam commodo nec nisl ut mollis.`;

(async () => {
  const now = Date.now();
  for(let i = 0; i < reportsToCreate; i++) {
    await createReport({
      createdBy: 4,
      category: 'bot',
      status: 'open',
      title: `seeded ${i}`,
      text: lorem.slice(0, 2048),
      createdAt: new Date(now - i * 5 * 60e3),
    });
    console.log('created', i)
  }

  process.exit(0);
})();