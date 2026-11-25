import { sqliteRepo } from "../src/lib/db/sqlite";

const MENU: Array<{ name: string; items: Array<{ name: string; description: string }> }> = [
  {
    name: "Cà phê",
    items: [
      { name: "Cà phê sữa đá", description: "Robusta đậm vị, sữa đặc và đá mát lạnh." },
      { name: "Bạc xỉu", description: "Nhiều sữa, cà phê vừa phải, dễ uống." },
      { name: "Cà phê đen đá", description: "Cà phê nguyên chất, hậu vị đậm." },
      { name: "Americano", description: "Espresso pha loãng, thanh vị và tỉnh táo." },
    ],
  },
  {
    name: "Trà & thanh mát",
    items: [
      { name: "Trà đào cam sả", description: "Trà đào thơm, cam vàng và sả tươi." },
      { name: "Trà sen vàng", description: "Trà oolong, hạt sen và củ sen giòn." },
      { name: "Trà chanh mật ong", description: "Chanh tươi, mật ong và trà lài." },
      { name: "Soda chanh dây", description: "Chanh dây chua ngọt, soda sảng khoái." },
    ],
  },
  {
    name: "Đá xay & sữa",
    items: [
      { name: "Cà phê đá xay", description: "Cà phê, sữa và kem tươi xay mịn." },
      { name: "Matcha đá xay", description: "Matcha Nhật, sữa tươi và đá xay." },
      {
        name: "Sữa tươi trân châu đường đen",
        description: "Sữa tươi, trân châu mềm và đường đen.",
      },
      { name: "Cacao sữa đá", description: "Cacao Hà Lan, sữa tươi và đá." },
    ],
  },
  {
    name: "Nước suối & trái cây",
    items: [
      { name: "Nước suối", description: "Chai nước suối mát lạnh." },
      { name: "Nước cam tươi", description: "Cam vắt nguyên chất, thêm chút mật ong." },
      { name: "Sinh tố xoài", description: "Xoài chín, sữa chua và sữa tươi." },
    ],
  },
];

const DEMO_GUESTS = [
  "Nguyễn Minh Anh",
  "Trần Thu Hà",
  "Lê Quang Huy",
  "Phạm Mai Linh",
  "Đỗ Thanh Tùng",
  "Vũ Hồng Nhung",
  "Hoàng Gia Bảo",
  "Bùi Khánh Ly",
  "Ngô Đức Thành",
  "Dương Ngọc Mai",
];

const demoCode = (index: number) => `DEMO-${String(index + 1).padStart(3, "0")}`;

async function main() {
  const categories = await sqliteRepo.listCategoriesWithItems(true);

  if (categories.length > 0) {
    console.log("Menu đã có dữ liệu, bỏ qua bước tạo menu mẫu.");
  } else {
    for (let groupIndex = 0; groupIndex < MENU.length; groupIndex += 1) {
      const group = MENU[groupIndex];
      const category = await sqliteRepo.createCategory({
        name: group.name,
        sortOrder: groupIndex + 1,
      });
      for (let itemIndex = 0; itemIndex < group.items.length; itemIndex += 1) {
        const item = group.items[itemIndex];
        await sqliteRepo.createMenuItem({
          categoryId: category.id,
          name: item.name,
          description: item.description,
          sortOrder: itemIndex + 1,
        });
      }
    }
    console.log(`Đã tạo menu mẫu: ${MENU.length} nhóm món.`);
  }

  const list = await sqliteRepo.listTickets({ page: 1, pageSize: 500 });
  const byCode = new Map(list.items.map((ticket) => [ticket.code, ticket]));
  let created = 0;
  let reset = 0;
  let checkedIn = 0;

  for (let index = 0; index < DEMO_GUESTS.length; index += 1) {
    const code = demoCode(index);
    let ticket = byCode.get(code);

    if (!ticket) {
      ticket = await sqliteRepo.createTicket({
        code,
        guestName: DEMO_GUESTS[index],
        phone: index % 3 === 0 ? `09010000${String(index + 1).padStart(2, "0")}` : null,
        note: index === 0 ? "Khách mời khai mạc" : null,
      });
      created += 1;
    } else if (ticket.orderedAt) {
      // Re-running seed frees demo tickets so the flow can be tested again.
      await sqliteRepo.resetTicketOrder(ticket.id);
      reset += 1;
    } else if (ticket.reservationToken) {
      await sqliteRepo.releaseReservation(ticket.reservationToken);
    }

    const fresh = await sqliteRepo.getTicketById(ticket.id);
    if (fresh && !fresh.checkedInAt) {
      await sqliteRepo.setTicketCheckIn(ticket.id, true);
      checkedIn += 1;
    }
  }

  console.log(
    `Đã xử lý ${DEMO_GUESTS.length} vé demo: tạo mới ${created}, reset đơn ${reset}, check-in ${checkedIn}.`,
  );
  const stats = await sqliteRepo.getStats();
  console.log(
    `Hoàn tất. Tổng vé: ${stats.totalTickets} · đã check-in: ${stats.checkedIn} · đã đặt nước: ${stats.ordered}.`,
  );
}

main().catch((error) => {
  console.error("Không seed được dữ liệu:", error);
  process.exitCode = 1;
});
