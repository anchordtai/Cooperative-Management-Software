import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  membershipNumber: string;
  joinDate: string;
  status: 'active' | 'inactive' | 'suspended';
  shareCapital: number;
  savings: number;
}

interface MemberState {
  members: Member[];
  selectedMember: Member | null;
  loading: boolean;
  error: string | null;
}

const initialState: MemberState = {
  members: [],
  selectedMember: null,
  loading: false,
  error: null,
};

const memberSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    fetchMembersStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    fetchMembersSuccess: (state, action: PayloadAction<Member[]>) => {
      state.loading = false;
      state.members = action.payload;
      state.error = null;
    },
    fetchMembersFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
    },
    selectMember: (state, action: PayloadAction<Member>) => {
      state.selectedMember = action.payload;
    },
    addMember: (state, action: PayloadAction<Member>) => {
      state.members.push(action.payload);
    },
    updateMember: (state, action: PayloadAction<Member>) => {
      const index = state.members.findIndex(member => member.id === action.payload.id);
      if (index !== -1) {
        state.members[index] = action.payload;
      }
    },
    deleteMember: (state, action: PayloadAction<string>) => {
      state.members = state.members.filter(member => member.id !== action.payload);
    },
  },
});

export const {
  fetchMembersStart,
  fetchMembersSuccess,
  fetchMembersFailure,
  selectMember,
  addMember,
  updateMember,
  deleteMember,
} = memberSlice.actions;

export default memberSlice.reducer; 